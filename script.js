// =================================================================
// ETHIO BINGO - FIREBASE FIRESTORE IMPLEMENTATION
// ደረጃ 2: የጨዋታ ሁኔታ ቁጥጥር እና የቢንጎ መጫወቻ ገጽ መጨመር
// =================================================================

// 1. ግሎባል ተለዋዋጮች (Global Variables)
let isLoggedIn = false; 
let currentBalance = 0.00; 
let currentUser = null; 
let isAdmin = false; 
const appContainer = document.getElementById('app-container');
const navContainer = document.getElementById('main-nav'); 
const adminTelebirrPhone = '0922675655'; // የአድሚኑ ቋሚ ቁጥር
const adminTelebirrName = 'ሚኪያስ'; 

// የቢንጎ ግሎባል ተለዋዋጮች
let selectedCardId = null; 
const GAME_STAKE = 10.00; // የመክፈያ ዋጋ 10 ብር
const FEE_PERCENTAGE = 0.15; // 15% የጨዋታ ድርሻ (ለድርጅቱ)
let countdownInterval = null; // የቆጣሪውን ኢንተርቫል ለመያዝ
let bingoCardsCache = {}; // የተፈጠሩ ካርዶችን ቁጥር በቋሚነት ለማከማቸት
const PRE_GAME_SECONDS = 30; // የካርድ መምረጫ ጊዜ

// አዲስ የጨዋታ ሁኔታ ተለዋዋጮች እና ሁኔታዎች
const GAME_COLLECTION = 'gameStatus';
const GAME_STATUSES = {
    WAITING: 'WAITING', // አድሚን አዲስ ጨዋታ እስኪጀምር በመጠባበቅ ላይ
    PRE_GAME: 'PRE_GAME', // የካርድ መምረጫ ጊዜ (30 ሰከንድ)
    IN_PROGRESS: 'IN_PROGRESS', // ጨዋታ ላይ ነው (ቁጥር እየተጠራ ነው)
    COMPLETED: 'COMPLETED' // ጨዋታው ተጠናቋል
};
let gameStatus = { 
    status: GAME_STATUSES.WAITING,
    currentRoundId: null,
    timeRemaining: PRE_GAME_SECONDS,
    calledNumbers: [], // እስካሁን የተጠሩ ቁጥሮች
    currentCall: null, // አሁን የተጠራው ቁጥር
    reservationsCount: 0 // አዲስ የገዙ ካርዶች ብዛት
};
const ALL_BINGO_NUMBERS = Array.from({ length: 75 }, (_, i) => i + 1); // 1-75

// የዳታቤዝ Collections - (በገጽ ጫና ላይ በ onSnapshot የሚሞሉ)
let allUsers = []; 
let pendingRecharges = []; 
let pendingWithdrawals = []; 
let bingoReservations = []; // የተያዙ ካርዶች (በ Firestore doc id 'card_ID' የሚቀመጡ)


// ----------------------------------------------------
// 2. የዳታቤዝ ግንኙነት (Firestore Listeners) 
// ----------------------------------------------------

/**
 * የተጠቃሚዎችን መረጃ ከ Firestore ላይ Real-time የሚከታተል ተግባር
 */
function listenToUsers() {
    // ሁሉም ተጠቃሚዎች 'users' በሚባል ስብስብ ውስጥ ይቀመጣሉ
    return db.collection('users').onSnapshot(snapshot => {
        allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // የአድሚን መለያ ከሌለ ማስገባት
        const adminExists = allUsers.some(u => u.phone === adminTelebirrPhone);
        if (!adminExists) {
            // የአድሚን መለያውን ወደ ዳታቤዝ ለመጀመሪያ ጊዜ ማስገባት
            db.collection('users').add({ 
                phone: adminTelebirrPhone, 
                password: 'adminpass', 
                name: adminTelebirrName, 
                balance: 1000.00, 
                referralCode: generateReferralCode(adminTelebirrPhone) 
            }).then(() => console.log("Admin account created in Firestore."));
        }

        // የአሁኑን ተጠቃሚ መረጃ ማዘመን
        if (currentUser) {
            const updatedUser = allUsers.find(u => u.phone === currentUser.phone);
            if (updatedUser) {
                currentUser = updatedUser;
                currentBalance = currentUser.balance;
            } else {
                 // ተጠቃሚው ከተሰረዘ ውጣ
                 handleLogout(false);
            }
        }
        
        // ገጹን ያዘምናል
        renderActivePage();

    }, error => {
        console.error("Error listening to users:", error);
    });
}

function listenToRecharges() {
    return db.collection('recharges').where('status', '==', 'Pending').onSnapshot(snapshot => {
        pendingRecharges = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (isAdmin) {
             renderActivePage();
        }
    }, error => {
        console.error("Error listening to recharges:", error);
    });
}

function listenToWithdrawals() {
    return db.collection('withdrawals').where('status', '==', 'Pending').onSnapshot(snapshot => {
        pendingWithdrawals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (isAdmin) {
            renderActivePage();
        }
    }, error => {
        console.error("Error listening to withdrawals:", error);
    });
}


/**
 * የተያዙ የቢንጎ ካርዶችን Real-time የሚከታተል ተግባር
 */
function listenToReservations() {
    return db.collection('bingoReservations').onSnapshot(snapshot => {
        bingoReservations = snapshot.docs.map(doc => ({ 
            id: doc.id, 
            cardId: doc.data().cardId,
            userId: doc.data().userId,
            userName: doc.data().userName,
            paid: doc.data().paid || false,
            roundId: doc.data().roundId,
            cardNumbers: doc.data().cardNumbers
        }));
        
        // የካርድ መያዣ ቆጠራን አዘምን
        gameStatus.reservationsCount = bingoReservations.filter(res => res.paid === true && res.roundId === gameStatus.currentRoundId).length;
        
        // ገጹ በሚጫንበት ጊዜ ካርዶችን ለማደስ
        if (window.location.hash === '#bingo-page') {
             updateCardColors(); 
             renderCardDisplay(); 
        } else if (window.location.hash === '#bingo-game-page') {
             renderBingoGamePage(); // የጨዋታ ገጹን አድስ
        }
    }, error => {
        console.error("Error listening to reservations:", error);
    });
}


/**
 * አዲስ: የጨዋታውን ሁኔታ (Game Status) Real-time የሚከታተል ተግባር
 */
function listenToGameStatus() {
    return db.collection(GAME_COLLECTION).doc('current').onSnapshot(doc => {
        if (doc.exists) {
            gameStatus = { ...gameStatus, ...doc.data() };
        } else {
             // ሁኔታው ከሌለ: መጀመሪያ ላይ እንፍጠር
             db.collection(GAME_COLLECTION).doc('current').set({
                status: GAME_STATUSES.WAITING,
                currentRoundId: new Date().getTime(),
                timeRemaining: 0,
                calledNumbers: [],
                currentCall: null,
                reservationsCount: 0 
             });
             gameStatus.status = GAME_STATUSES.WAITING;
        }
        renderActivePage(); // ሁኔታ ሲቀየር ገጹን ያድሳል
    }, error => {
        console.error("Error listening to game status:", error);
    });
}


// ----------------------------------------------------
// 3. ረዳት ፋንክሽኖች
// ----------------------------------------------------

function generateReferralCode(phone) {
    const lastFour = phone.slice(-4);
    const randomThree = Math.floor(100 + Math.random() * 900);
    return `ET${lastFour}${randomThree}`;
}

function copyReferralCode(code) {
    // ... (የቅጂ ተግባር - ሳይቀየር ቀርቷል)
    navigator.clipboard.writeText(code).then(() => {
        const messageElement = document.getElementById('copy-message');
        if (messageElement) {
            messageElement.style.display = 'block';
            setTimeout(() => {
                messageElement.style.display = 'none';
            }, 2000);
        }
    }).catch(err => {
        console.error('Copy failed:', err);
        const messageElement = document.getElementById('copy-message');
        if (messageElement) {
             messageElement.textContent = 'ኮዱን መገልበጥ አልተቻለም። በእጅዎ ይቅዱት!';
             messageElement.style.color = 'red';
             messageElement.style.display = 'block';
             setTimeout(() => { messageElement.style.display = 'none'; }, 3000);
        }
    });
}


// ----------------------------------------------------
// 4. የገጽ አሰሳ እና ጅምር (Navigation and Initialization)
// ----------------------------------------------------

function renderActivePage() {
    const hash = window.location.hash;
    renderNavbar(); 
    
    // 1. መግቢያን ማረጋገጥ
    if (!isLoggedIn && hash !== '#register-page' && hash !== '#login-page') {
        window.location.hash = '#login-page';
        return;
    }
    
    // 2. የቢንጎ ሁኔታ ላይ የተመሰረተ አሰሳ
    if (isLoggedIn) {
        if (gameStatus.status === GAME_STATUSES.IN_PROGRESS) {
             // ጨዋታው እየተካሄደ ከሆነ ወደ ጨዋታ ገጹ ይሂዱ
             window.location.hash = '#bingo-game-page';
             renderBingoGamePage();
             return;
        } else if (gameStatus.status === GAME_STATUSES.PRE_GAME || hash === '#bingo-page') {
             // ካርድ መምረጫ ጊዜ ከሆነ ወደ ምርጫ ገጽ ይሂዱ
             window.location.hash = '#bingo-page';
             renderBingoPage();
             return;
        }
    }
    
    // 3. የገጽ አሳሽ
    if (hash === '#register-page') {
        renderRegisterPage();
    } else if (hash === '#login-page') {
        renderLoginPage();
    } else if (hash === '#account-page') {
        renderAccountPage();
    } else if (hash === '#recharge-form-page') {
        renderRechargeFormPage();
    } else if (hash === '#withdraw-form-page') {
        renderWithdrawFormPage();
    } else if (hash === '#change-password-page') { 
        renderChangePasswordPage();
    } else if (hash === '#user-list-page') { 
        renderUserListPage();
    } else if (hash === '#bingo-game-page' && isLoggedIn) {
         // ጨዋታው ካልተጀመረ እና ገጹ ላይ ከሆኑ ወደ መለያ ይምሩ
         window.location.hash = '#account-page';
    } else {
        // ምንም hash ከሌለ ወይም ያልታወቀ ከሆነ
        if (isLoggedIn) {
             window.location.hash = '#account-page';
        } else {
             window.location.hash = '#login-page';
        }
    }
}


function renderNavbar() {
    if (!navContainer) return; 
    let navHtml = '';
    const currentHash = window.location.hash;
    
    const balanceDisplay = isLoggedIn ? 
        `<span style="margin-left: 10px; padding: 5px 10px; background-color: #f7b731; color: #333; border-radius: 5px; font-weight: bold;">Wallet: ETB ${currentBalance.toFixed(2)}</span>` : '';

    if (isLoggedIn) {
        const bingoHash = (gameStatus.status === GAME_STATUSES.IN_PROGRESS) ? '#bingo-game-page' : '#bingo-page';
        
        navHtml = `
            <a href="${bingoHash}" class="${currentHash === '#bingo-page' || currentHash === '#bingo-game-page' ? 'active' : ''}">
                <i class="fas fa-gamepad"></i> ቢንጎ ተጫወት
            </a>
            <a href="#account-page" class="${currentHash === '#account-page' ? 'active' : ''}">
                <i class="fas fa-user-circle"></i> የኔ መለያ
            </a>
            
            ${balanceDisplay}
            <button onclick="handleLogout()" class="nav-logout-btn">
                <i class="fas fa-sign-out-alt"></i> ውጣ
            </button>
        `;
    } else {
        navHtml = `
            <a href="#login-page" class="${currentHash === '#login-page' ? 'active' : ''}">
                <i class="fas fa-sign-in-alt"></i> ግባ
            </a>
            <a href="#register-page" class="${currentHash === '#register-page' ? 'active' : ''}">
                <i class="fas fa-user-plus"></i> ተመዝገብ
            </button>
        `;
    }
    navContainer.innerHTML = navHtml;

    // Style the links and buttons
    navContainer.querySelectorAll('a, button').forEach(link => {
        link.style.cssText += `
            color: #fff; 
            text-decoration: none; 
            padding: 10px 15px; 
            margin: 0 5px; 
            border-radius: 5px;
            transition: background-color 0.3s;
            font-family: inherit;
        `;
        
        if (link.tagName === 'A' && link.classList.contains('active')) {
            link.style.backgroundColor = '#004a99';
        } else if (link.classList.contains('nav-logout-btn')) {
             link.style.cssText += `
                background: none; 
                border: none; 
                color: #fff; 
                cursor: pointer; 
                font-size: 1em;
             `;
        }
    });
}

// ----------------------------------------------------
// 5. የአካውንት አስተዳደር ፋንክሽኖች (ሳይቀየሩ ቀርተዋል)
// ----------------------------------------------------

async function handleRegistration(e) {
    // ... (የምዝገባ ተግባር - ሳይቀየር ቀርቷል)
    e.preventDefault();
    
    const name = document.getElementById('reg-name').value.trim(); 
    const phone = document.getElementById('reg-phone').value;
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value; 
    const inviteCode = document.getElementById('reg-invite').value.trim().toUpperCase(); 

    if (password !== confirmPassword) { alertUser('የይለፍ ቃሉ እና የማረጋገጫ ይለፍ ቃሉ አይመሳሰለሉም! እባክዎ በትክክል ያስገቡ።', 'error'); return; }
    if (name.length < 2) { alertUser('እባክዎ ትክክለኛ ስምዎን ያስገቡ።', 'error'); return; }
    
    if (allUsers.some(user => user.phone === phone)) { alertUser(`ይህ ስልክ ቁጥር (${phone}) አስቀድሞ ተመዝግቧል። ወደ መግቢያ ገጽ ይሂዱ።`, 'error'); return; }
    
    const newReferralCode = generateReferralCode(phone);
    
    const newUser = { phone: phone, password: password, name: name, balance: 0.00, referralCode: newReferralCode };
    
    let rewardMessage = '';
    
    try {
        if (inviteCode) {
            const referrer = allUsers.find(user => user.referralCode === inviteCode);
            if (referrer && referrer.phone !== phone) {
                const rewardAmount = 10.00;
                
                await db.collection('users').doc(referrer.id).update({
                    balance: firebase.firestore.FieldValue.increment(rewardAmount)
                });
                rewardMessage = `እና ጋባዥዎ (${referrer.name}) በ ${rewardAmount.toFixed(2)} ETB ሽልማት አግኝተዋል።`;
            } else if (referrer && referrer.phone === phone) { alertUser("የራስዎን ስልክ ቁጥር ወይም ኮድ መጠቀም አይችሉም!", 'error'); } 
            else { alertUser("ያስገቡት የመጋበዣ ኮድ ትክክል አይደለም።", 'error'); }
        }
        
        await db.collection('users').add(newUser);
        
        alertUser(`በተሳካ ሁኔታ ተመዝግበዋል! አሁን መግባት ይችላሉ። ${rewardMessage}`, 'success');
        window.location.hash = '#login-page'; 

    } catch (e) {
        console.error("Error during registration:", e);
        alertUser('በምዝገባ ወቅት ችግር ተፈጥሯል። እባክዎ እንደገና ይሞክሩ።', 'error');
    }
}

function renderRegisterPage() {
    // ... (የምዝገባ ገጽ - ሳይቀየር ቀርቷል)
    appContainer.innerHTML = `<div class="page-container"><h2>አዲስ መለያ ይክፈቱ</h2><form id="register-form"><div class="form-group"><label for="reg-name"><i class="fas fa-user"></i> ስምዎን ያስገቡ:</label><input type="text" id="reg-name" name="name" placeholder="ሙሉ ስምዎን ያስገቡ" required></div><div class="form-group"><label for="reg-phone"><i class="fas fa-phone"></i> ስልክ ቁጥር:</label><input type="tel" id="reg-phone" name="phone" placeholder="ለምሳሌ: 09..." required></div><div class="form-group"><label for="reg-password"><i class="fas fa-lock"></i> የይለፍ ቃል:</label><input type="password" id="reg-password" name="password" required></div><div class="form-group"><label for="reg-confirm-password"><i class="fas fa-check-lock"></i> የይለፍ ቃል አረጋግጥ:</label><input type="password" id="reg-confirm-password" name="confirm_password" required></div><div class="form-group"><label for="reg-invite"><i class="fas fa-user-plus"></i> የመጋበዣ ኮድ (አማራጭ):</label><input type="text" id="reg-invite" name="invite_code" placeholder="ጋባዥ ካለ ኮዱን ያስገቡ"></div><button type="submit" class="submit-button">መዝግብ</button><p style="margin-top: 15px;">መለያ አለዎት? <a href="#login-page">ይግቡ</a></p><div id="alert-message-box" style="margin-top: 10px;"></div></form></div>`;
    document.getElementById('register-form').addEventListener('submit', handleRegistration);
}

function handleLogin(e) {
    // ... (የመግቢያ ተግባር - ሳይቀየር ቀርቷል)
    e.preventDefault();
    
    const phone = document.getElementById('log-phone').value;
    const password = document.getElementById('log-password').value;
    
    const userFound = allUsers.find(user => user.phone === phone && user.password === password);
    
    if (userFound) {
        currentUser = userFound;
        currentBalance = currentUser.balance; 
        isAdmin = (phone === adminTelebirrPhone);
        isLoggedIn = true;
        
        localStorage.setItem('currentUserPhone', phone);

        alertUser(isAdmin ? 'በአድሚንነት ገብተዋል!' : 'በተጠቃሚነት ገብተዋል!', 'success');
        window.location.hash = '#account-page';
    } else {
        alertUser('ስልክ ቁጥር ወይም የይለፍ ቃል ትክክል አይደለም። ወይም አልተመዘገቡም።', 'error');
        isLoggedIn = false;
        isAdmin = false;
        currentUser = null;
        localStorage.removeItem('currentUserPhone');
    }
    renderActivePage();
}
function renderLoginPage() {
    // ... (የመግቢያ ገጽ - ሳይቀየር ቀርቷል)
    appContainer.innerHTML = `<div class="page-container"><h2>ወደ መለያዎ ይግቡ</h2><form id="login-form"><div class="form-group"><label for="log-phone"><i class="fas fa-phone"></i> ስልክ ቁጥር:</label><input type="tel" id="log-phone" name="phone" required></div><div class="form-group"><label for="log-password"><i class="fas fa-lock"></i> የይለፍ ቃል:</label><input type="password" id="log-password" name="password" required></div><button type="submit" class="submit-button">ግባ</button></form><p style="margin-top: 15px;">አዲስ ነዎት? <a href="#register-page">ይመዝገቡ</a></p><div id="alert-message-box" style="margin-top: 10px;"></div></div>`;
    document.getElementById('login-form').addEventListener('submit', handleLogin);
}

// ----------------------------------------------------
// 6. የግብይት ፋንክሽኖች (ሳይቀየሩ ቀርተዋል)
// ----------------------------------------------------

function renderRechargeFormPage() {
    // ... (ገቢ የማስገቢያ ገጽ - ሳይቀየር ቀርቷል)
    if (!isLoggedIn) { window.location.hash = '#login-page'; return; }
    appContainer.innerHTML = `<div class="page-container"><h2><i class="fas fa-plus-circle"></i> ገንዘብ አስገባ (Recharge)</h2><div class="account-info" style="text-align: center;"><p style="font-size: 1.1em; font-weight: bold; color: #cc0000;">**መጀመሪያ ገንዘቡን ይላኩ!**</p><p>ገንዘቡን ወደሚከተለው የቴሌብር ቁጥር ይላኩ፡</p><p style="font-size: 1.4em; color: #004a99; font-weight: bold;"><i class="fas fa-mobile-alt"></i> ${adminTelebirrPhone} (${adminTelebirrName})</p><p style="margin-top: 15px; font-weight: bold;">ገንዘቡን ከላኩ በኋላ የሚከተለውን ቅፅ ይሙሉ።</p></div><form id="recharge-form" style="margin-top: 20px;"><div class="form-group"><label for="recharge-amount"><i class="fas fa-money-bill-wave"></i> የገንዘብ መጠን (ETB):</label><input type="number" id="recharge-amount" required min="10"></div><div class="form-group"><label for="transaction-id"><i class="fas fa-key"></i> የግብይት መለያ ቁጥር (Transaction ID):</label><input type="text" id="transaction-id" placeholder="ገንዘብ ከላኩ በኋላ የሚደርስዎትን ID ያስገቡ" required></div><button type="submit" class="submit-button btn-recharge">ጥያቄ ላክ</button></form><button onclick="window.location.hash = '#account-page'" class="submit-button" style="background-color: #aaa; margin-top: 10px;">ተመለስ</button><div id="alert-message-box" style="margin-top: 10px;"></div></div>`;
    document.getElementById('recharge-form').addEventListener('submit', handleRechargeRequest);
}
async function handleRechargeRequest(e) {
    // ... (ገቢ የማስገቢያ ተግባር - ሳይቀየር ቀርቷል)
    e.preventDefault();
    
    const amount = document.getElementById('recharge-amount').value;
    const transactionId = document.getElementById('transaction-id').value.trim();
    const numAmount = parseFloat(amount);

    if (numAmount < 10) { alertUser("ቢያንስ 10 ETB ማስገባት አለብዎት።", 'error'); return; }
    if (transactionId.length < 5) { alertUser("እባክዎ ትክክለኛ የግብይት መለያ ቁጥር (Transaction ID) ያስገቡ።", 'error'); return; }
    
    const existingReq = pendingRecharges.find(req => req.transactionId === transactionId);
    if (existingReq) { alertUser("ይህ የግብይት መለያ ቁጥር አስቀድሞ በጥበቃ ላይ ነው።", 'error'); return; }
    
    const request = { userPhone: currentUser.phone, amount: numAmount, transactionId: transactionId, date: new Date().toLocaleString('am-ET'), status: 'Pending' };
    
    try {
        await db.collection('recharges').add(request); 
        alertUser(`የ ETB ${numAmount.toFixed(2)} ማስገቢያ ጥያቄዎ በተሳካ ሁኔታ ተልኳል።`, 'success');
        window.location.hash = '#account-page';
    } catch (e) {
         console.error("Error sending recharge request:", e);
         alertUser('ጥያቄውን በመላክ ላይ ስህተት ተፈጥሯል።', 'error');
    }
}

async function confirmRecharge(requestId, amount, userPhone) {
    // ... (ገቢ የማረጋገጫ ተግባር - ሳይቀየር ቀርቷል)
    if (!isAdmin) { return; } 

    if (!await customConfirm(`ይህንን የ ${amount.toFixed(2)} ETB ገቢ በእርግጥ ለተጠቃሚ ${userPhone} ማረጋገጥ ይፈልጋሉ?`)) { return; }
    
    const targetUser = allUsers.find(user => user.phone === userPhone);
    
    if (!targetUser) { alertUser(`ስልክ ቁጥር ${userPhone} ያለው ተጠቃሚ አልተገኘም!`, 'error'); return; }

    try {
        await db.collection('users').doc(targetUser.id).update({
            balance: firebase.firestore.FieldValue.increment(amount)
        });

        await db.collection('recharges').doc(requestId).update({
            status: 'Confirmed'
        });
        
        alertUser(`ETB ${amount.toFixed(2)} በተሳካ ሁኔታ ወደ ተጠቃሚ ${userPhone} ሂሳብ ገብቷል።`, 'success');

    } catch (e) {
        console.error("Error confirming recharge:", e);
        alertUser('ገቢውን በማረጋገጥ ላይ ስህተት ተፈጥሯል።', 'error');
    }
}

async function handleWithdraw(e) {
    // ... (ገንዘብ ማውጫ ጥያቄ ተግባር - ሳይቀየር ቀርቷል)
    e.preventDefault();

    const bank = document.getElementById('withdraw-bank').value;
    const account = document.getElementById('withdraw-account').value.trim();
    const name = document.getElementById('withdraw-name').value.trim();
    const amount = document.getElementById('withdraw-amount').value;
    const numAmount = parseFloat(amount);
    
    if (numAmount < 10) { alertUser("ቢያንስ 10 ETB ማውጣት አለብዎት።", 'error'); return; }
    
    const updatedUser = allUsers.find(u => u.phone === currentUser.phone);
    if (!updatedUser || numAmount > updatedUser.balance) { 
        alertUser("በመለያዎ ውስጥ በቂ ገንዘብ የለም! ቀሪ ሂሳብ: ETB " + (updatedUser ? updatedUser.balance.toFixed(2) : currentBalance.toFixed(2)), 'error'); 
        return; 
    }
    
    const request = { 
        userPhone: currentUser.phone, 
        userName: currentUser.name, 
        amount: numAmount, 
        bank: bank, 
        account: account, 
        accountName: name, 
        date: new Date().toLocaleString('am-ET'), 
        status: 'Pending' 
    };

    try {
        await db.collection('withdrawals').add(request); 
        
        await db.collection('users').doc(updatedUser.id).update({
            balance: firebase.firestore.FieldValue.increment(-numAmount)
        });
        
        alertUser(`የ ETB ${numAmount.toFixed(2)} የማውጫ ጥያቄዎ በተሳካ ሁኔታ ተልኳል።`, 'success');
        window.location.hash = '#account-page';
        
    } catch (e) {
        console.error("Error sending withdrawal request:", e);
        alertUser('የማውጫ ጥያቄውን በመላክ ላይ ስህተት ተፈጥሯል።', 'error');
    }
}
async function confirmWithdrawal(requestId) {
    // ... (ገንዘብ ማውጫ ማረጋገጫ ተግባር - ሳይቀየር ቀርቷል)
    if (!isAdmin) { return; }

    const request = pendingWithdrawals.find(req => req.id === requestId);
    if (!request) { alertUser("ይህ የማውጫ ጥያቄ አልተገኘም!", 'error'); return; }
    
    if (!await customConfirm(`ገንዘቡን ለተጠቃሚው ${request.userPhone} ወደ ${request.bank} አካውንት ${request.account} አስተላልፈዋል?`)) { return; }

    try {
        await db.collection('withdrawals').doc(requestId).update({
            status: 'Confirmed'
        });
        alertUser('ክፍያ በተሳካ ሁኔታ ተረጋግጧል።', 'success');
    } catch (e) {
        console.error("Error confirming withdrawal:", e);
        alertUser('ክፍያውን በማረጋገጥ ላይ ስህተት ተፈጥሯል።', 'error');
    }
}

function renderWithdrawFormPage() {
    // ... (ገንዘብ ማውጫ ገጽ - ሳይቀየር ቀርቷል)
    if (!isLoggedIn || !currentUser) { window.location.hash = '#login-page'; return; }
    appContainer.innerHTML = `<div class="page-container"><h2><i class="fas fa-minus-circle"></i> ገንዘብ አውጣ (Withdraw)</h2><div class="account-info" style="margin-bottom: 20px;"><p>አሁን ያለዎት ቀሪ ሂሳብ: **ETB ${currentBalance.toFixed(2)}**</p></div><form id="withdraw-form" style="margin-top: 20px;"><div class="form-group"><label for="withdraw-bank"><i class="fas fa-university"></i> ገንዘብ የሚላክበት ባንክ:</label><select id="withdraw-bank" name="bank" required><option value="">-- ባንክ ይምረጡ --</option><option value="CBE">ንግድ ባንክ (CBE)</option><option value="Abyssinia">አቢሲኒያ ባንክ</option><option value="Dashen">ዳሽን ባንክ</option><option value="Telebirr">ቴሌብር</option><option value="Awash">አዋሽ ባንክ</option></select></div><div class="form-group"><label for="withdraw-account"><i class="fas fa-wallet"></i> የባንክ ሂሳብ/ስልክ ቁጥር:</label><input type="text" id="withdraw-account" placeholder="የባንክ ሂሳብ ቁጥር ወይም የቴሌብር ስልክ" required></div><div class="form-group"><label for="withdraw-name"><i class="fas fa-user-tag"></i> የስምዎ ማረጋገጫ:</label><input type="text" id="withdraw-name" placeholder="በባንክ አካውንት ላይ ያለዎትን ስም ያስገቡ" required></div><div class="form-group"><label for="withdraw-amount"><i class="fas fa-money-bill-wave"></i> የገንዘብ መጠን (ETB):</label><input type="number" id="withdraw-amount" required min="10"></div><button type="submit" class="submit-button btn-withdraw">ጥያቄ ላክ</button></form><button onclick="window.location.hash = '#account-page'" class="submit-button" style="background-color: #aaa; margin-top: 10px;">ተመለስ</button><div id="alert-message-box" style="margin-top: 10px;"></div></div>`;
    document.getElementById('withdraw-form').addEventListener('submit', handleWithdraw);
}


// ----------------------------------------------------
// 7. የይለፍ ቃል መቀየሪያ ሎጂክ (ሳይቀየር ቀርቷል)
// ----------------------------------------------------

function renderChangePasswordPage() {
    // ... (የይለፍ ቃል መቀየሪያ ገጽ - ሳይቀየር ቀርቷል)
    if (!isLoggedIn || !currentUser) { window.location.hash = '#login-page'; return; }
    
    appContainer.innerHTML = `
        <div class="page-container">
            <h2><i class="fas fa-key"></i> የይለፍ ቃል መቀየሪያ</h2>
            <form id="change-password-form">
                <div class="form-group">
                    <label for="old-password"><i class="fas fa-lock"></i> አሁን ያለዎ የይለፍ ቃል:</label>
                    <input type="password" id="old-password" required>
                </div>
                <div class="form-group">
                    <label for="new-password"><i class="fas fa-unlock-alt"></i> አዲስ የይለፍ ቃል:</label>
                    <input type="password" id="new-password" required minlength="5">
                </div>
                <div class="form-group">
                    <label for="confirm-new-password"><i class="fas fa-check-lock"></i> አዲስ የይለፍ ቃል አረጋግጥ:</label>
                    <input type="password" id="confirm-new-password" required minlength="5">
                </div>
                <button type="submit" class="submit-button" style="background-color: #004a99;">ቀይር</button>
            </form>
            <button onclick="window.location.hash = '#account-page'" class="submit-button" style="background-color: #aaa; margin-top: 10px;">ተመለስ</button>
            <div id="alert-message-box" style="margin-top: 10px;"></div>
        </div>
    `;
    document.getElementById('change-password-form').addEventListener('submit', handleChangePassword);
}

async function handleChangePassword(e) {
    // ... (የይለፍ ቃል መቀየሪያ ተግባር - ሳይቀየር ቀርቷል)
    e.preventDefault();
    
    const oldPassword = document.getElementById('old-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmNewPassword = document.getElementById('confirm-new-password').value;

    if (oldPassword !== currentUser.password) { alertUser("አሁን ያስገቡት የይለፍ ቃል ትክክል አይደለም!", 'error'); return; }
    if (newPassword.length < 5) { alertUser("አዲሱ የይለፍ ቃል ቢያንስ 5 ፊደላት/ቁጥሮች መያዝ አለበት።", 'error'); return; }
    if (newPassword !== confirmNewPassword) { alertUser("አዲሱ የይለፍ ቃል እና የማረጋገጫው ቃል አይመሳሰለሉም!", 'error'); return; }
    if (newPassword === oldPassword) { alertUser("አዲስ የይለፍ ቃልዎ ከድሮው የይለፍ ቃልዎ ጋር መመሳሰል የለበትም!", 'error'); return; }
    
    try {
        await db.collection('users').doc(currentUser.id).update({
            password: newPassword
        });
        
        currentUser.password = newPassword; 
        alertUser("የይለፍ ቃልዎ በተሳካ ሁኔታ ተቀይሯል።", 'success');
        window.location.hash = '#account-page';

    } catch (e) {
        console.error("Error changing password:", e);
        alertUser('የይለፍ ቃልዎን በመቀየር ላይ ስህተት ተፈጥሯል።', 'error');
    }
}


// ----------------------------------------------------
// 8. የቢንጎ ጨዋታ ሎጂክ (አብዛኛው ለውጥ እዚህ ላይ ነው)
// ----------------------------------------------------

/**
 * ትክክለኛ የቢንጎ ካርድ ቁጥሮችን (B-I-N-G-O ደንብን ተከትሎ) የሚያመነጭ ተግባር
 */
function generateBingoCardNumbers() {
    const getRandomNumbers = (min, max, count) => {
        const numbers = [];
        while (numbers.length < count) {
            const num = Math.floor(Math.random() * (max - min + 1)) + min;
            if (!numbers.includes(num)) {
                numbers.push(num);
            }
        }
        return numbers.sort((a, b) => a - b);
    };

    const B = getRandomNumbers(1, 15, 5);
    const I = getRandomNumbers(16, 30, 5);
    const N_raw = getRandomNumbers(31, 45, 4); 
    const G = getRandomNumbers(46, 60, 5);
    const O = getRandomNumbers(61, 75, 5);

    const N = [...N_raw.slice(0, 2), 'FREE', ...N_raw.slice(2)];
    
    const finalCard = [];
    for (let row = 0; row < 5; row++) {
        finalCard.push(B[row]);
        finalCard.push(I[row]);
        finalCard.push(N[row]);
        finalCard.push(G[row]);
        finalCard.push(O[row]);
    }
    
    return finalCard;
}

/**
 * *የተስተካከለ*፡ አንድ ካርድ ሲመረጥ ወይም ሲሰረዝ የሚጠራ ተግባር
 * ለውጥ: ተጠቃሚው ካርድ ከገዛ በኋላም ቢሆን፣ ቆጣሪው እስኪጠናቀቅ ድረስ ሌላ ካርድ መግዛት (በመጀመሪያው ካርድ ላይ ገንዘብ ተመላሽ ተደርጎ) ይችላል።
 */
async function selectCard(cardId) {
    if (!currentUser) return;
    
    // የካርድ ምርጫ የሚቻለው በ PRE_GAME ሁኔታ ውስጥ ብቻ ነው።
    if (gameStatus.status !== GAME_STATUSES.PRE_GAME) {
        alertUser('ካርድ መምረጥ አይቻልም። ጨዋታው እየተካሄደ ነው/አልተጀመረም።', 'error');
        return;
    }

    // የራሱ የተገዛ ካርድ መኖር አለመኖሩን አረጋግጥ
    const existingMyCard = bingoReservations.find(res => res.userId === currentUser.id && res.paid && res.roundId === gameStatus.currentRoundId);
    
    // 2. የካርዱን ሁኔታ ማረጋገጥ (Reservation Check)
    const existingReservation = bingoReservations.find(res => res.cardId === cardId && res.roundId === gameStatus.currentRoundId);
    
    if (existingReservation && existingReservation.paid && existingReservation.userId !== currentUser.id) {
        alertUser(`ይህ ካርድ #${cardId} በሌላ ተጫዋች ተይዟል። መምረጥ አይቻልም!`, 'error');
        return;
    } else if (existingMyCard && existingMyCard.cardId === cardId) {
         // *ለውጥ*: አስቀድሞ ይሄንኑ ካርድ ገዝቷል (ምርጫ አይቀየርም)
         alertUser(`ካርድ #${cardId} አስቀድሞ ገዝተዋል።`, 'info');
         selectedCardId = cardId;
         renderCardDisplay();
         updateCardColors();
         return;
    }
    
    // 3. የሒሳብ በቂነት ማረጋገጥ (ለ አዲስ ግዢ)
    const updatedUser = allUsers.find(u => u.phone === currentUser.phone);
    // ገንዘብ ያለው ለውጥ ለማድረግ ብቻ ከሆነ ማረጋገጥ አያስፈልግም
    if (!updatedUser || updatedUser.balance < GAME_STAKE) {
        if (!existingMyCard) { // አዲስ ካርድ ለመግዛት ከፈለገ
            alertUser(`ሒሳብዎ በቂ አይደለም። ቢያንስ ${GAME_STAKE.toFixed(2)} ETB ያስፈልጋል። ቀሪ ሂሳስ: ${currentBalance.toFixed(2)} ETB`, 'error');
            return;
        }
    }
    
    // 4. የቀድሞ ምርጫን ማስለቀቅ (Release Previous Reservation) እና ገንዘብ ተመላሽ ማድረግ
    if (existingMyCard) {
        // የድሮውን ካርድ ይሰርዛል፣ ገንዘቡን ይመልሳል፣ አዲሱን ይገዛል
        try {
            // 4.1. ገንዘብን መመለስ (Refund) - ገዢው ካርዱን ስለቀየረ
            await db.collection('users').doc(updatedUser.id).update({
                balance: firebase.firestore.FieldValue.increment(GAME_STAKE)
            });
            
            // 4.2. የድሮውን Reservation መሰረዝ
            await db.collection('bingoReservations').doc(existingMyCard.id).delete();
            
            // *ለውጥ*: ገንዘብ መመለስ መሳካቱን ለማሳወቅ
            alertUser(`የድሮው ካርድ #${existingMyCard.cardId} ተሽሯል (ገንዘብ ተመልሷል)። አሁን አዲስ ካርድ #${cardId} ይገዛል።`, 'info');
        } catch (e) {
            console.error("Error refunding previous card:", e);
            alertUser('የድሮውን ካርድ በመሰረዝ ላይ ስህተት ተፈጥሯል። እባክዎ እንደገና ይሞክሩ።', 'error');
            return; 
        }
    }

    // 5. አዲስ ምርጫን መያዝ (Make New Reservation) እና ወዲያውኑ መክፈል
    selectedCardId = cardId;
    
    try {
        // 5.1. ገንዘብን መቀነስ (ወዲያውኑ) - አዲሱን ካርድ ለመግዛት
         await db.collection('users').doc(updatedUser.id).update({
            balance: firebase.firestore.FieldValue.increment(-GAME_STAKE)
        });
        
        // 5.2. Reservation ን በ 'paid: true' ማስመዝገብ
        const cardNumbers = generateBingoCardNumbers();
        // የ Reservation ID አዲሱን ካርድ ቁጥር ያካትታል
        const reservationRef = db.collection('bingoReservations').doc(`card_${gameStatus.currentRoundId}_${cardId}`);
        
        await reservationRef.set({
            cardId: cardId,
            userId: currentUser.id,
            userName: currentUser.name || 'Unknown User',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            paid: true, 
            gameStake: GAME_STAKE,
            roundId: gameStatus.currentRoundId, // አሁን ያለውን የጨዋታ ዙር መመዝገብ
            cardNumbers: cardNumbers 
        });
        bingoCardsCache[cardId] = cardNumbers;
        
        // 6. የካርዱን ቁጥሮች መጫንና ማሳየት
        renderCardDisplay();
        
        alertUser(`ካርድ #${cardId} በ ${GAME_STAKE.toFixed(2)} ETB ተገዝቶ ተይዟል።`, 'success');
        updateCardColors(); 
        
    } catch (e) {
        console.error("Error making new reservation and paying:", e);
        selectedCardId = null; 
        
        // ክፍያው ካልተሳካ ገንዘቡን ይመልስ (ከድሮ ካርድ ተመላሽ ከሆነ አያስፈልግም, ምክንያቱም አሁን እዚህ የመጣው ከተመላሽ በኋላ ነው)
        // ነገር ግን የ Firestore Write ካልተሳካ ገንዘቡን መመለስ አለበት
        await db.collection('users').doc(updatedUser.id).update({
             balance: firebase.firestore.FieldValue.increment(GAME_STAKE) // ገንዘቡን መልስ
        });

        alertUser('ካርዱን በመግዛት ላይ ስህተት ተፈጥሯል። እባክዎ እንደገና ይሞክሩ።', 'error');
    }
}


/**
 * ካርድ ከምርጫ ሲወጣ ቦታውን በ Firestore ላይ የሚለቅ ተግባር (በጨዋታ መጨረሻ ላይ ብቻ)
 */
async function releaseReservation(reservationId, refund = false) {
    try {
        if (refund) {
             const res = bingoReservations.find(r => r.id === reservationId);
             const user = allUsers.find(u => u.id === res.userId);
             if (user) {
                  await db.collection('users').doc(user.id).update({
                      balance: firebase.firestore.FieldValue.increment(res.gameStake)
                  });
             }
        }
        
        await db.collection('bingoReservations').doc(reservationId).delete();
    } catch (e) {
        console.error("Error releasing reservation:", e);
    }
}


/**
 * *የተስተካከለ*፡ የተመረጠውን ካርድ ይዘት የሚያሳይ ተግባር
 */
function renderCardDisplay(cardId = selectedCardId, numbers = null) {
    const displayElement = document.getElementById('selected-card-display');
    if (!displayElement) return;
    
    const myReservation = bingoReservations.find(res => res.userId === currentUser.id && res.paid && res.roundId === gameStatus.currentRoundId);
    
    if (!myReservation) {
        displayElement.innerHTML = `<p style="color: #888;">ካርድ ሲመርጡ የካርዱ ቁጥሮች እዚህ ይታያሉ።</p>`;
        selectedCardId = null;
        return;
    }
    
    cardId = myReservation.cardId;
    numbers = myReservation.cardNumbers;
    selectedCardId = cardId; // ለቋሚነት
    
    let numbersHtml = '<div style="display: grid; grid-template-columns: repeat(5, 1fr); max-width: 300px; margin: 0 auto; font-size: 1em;">';
    
    const letters = ['B', 'I', 'N', 'G', 'O'];
    numbersHtml += letters.map(l => `<div style="padding: 5px; font-weight: bold; background-color: #004a99; color: white;">${l}</div>`).join('');
    
    numbers.forEach((num) => {
        const isFree = num === 'FREE';
        const cellStyle = isFree ? 
            'background-color: #38761d; color: white; font-weight: bold;' : 
            'background-color: #38761d; color: white;';
        
        numbersHtml += `<div style="padding: 5px; border: 1px solid #aaa; ${cellStyle}">${num}</div>`;
    });
    
    numbersHtml += '</div>';
    
    displayElement.innerHTML = `
        <p style="font-weight: bold; color: #004a99; margin-bottom: 5px;">የእርስዎ የተገዛ ካርድ #${cardId}</p>
        <p style="color: #38761d; font-weight: bold;">(ክፍያ ${GAME_STAKE.toFixed(2)} ETB ተፈጽሟል)</p>
        ${numbersHtml}
        
        <p style="color: #cc0000; margin-top: 10px; font-weight: bold;">የመምረጫ ጊዜው እስኪያልቅ ድረስ ካርዱን መቀየር ይችላሉ።</p>
    `;
}

/**
 * የቆጣሪ ተግባር (ለ PRE_GAME ጊዜ ብቻ)
 */
function startCountdown() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    
    // ቆጣሪው የሚሰራው በ PRE_GAME ሁኔታ ላይ ብቻ ነው
    if (gameStatus.status !== GAME_STATUSES.PRE_GAME) {
         const timerElement = document.getElementById('bingo-timer');
         if (timerElement) {
            timerElement.textContent = (gameStatus.status === GAME_STATUSES.IN_PROGRESS) ? 'በሂደት ላይ ነው!' : 'ዝግጁ አይደለም!';
            timerElement.style.color = (gameStatus.status === GAME_STATUSES.IN_PROGRESS) ? '#38761d' : '#cc0000';
         }
         return;
    }
    
    let remaining = gameStatus.timeRemaining;
    const timerElement = document.getElementById('bingo-timer');

    countdownInterval = setInterval(async () => {
        if (!timerElement) {
             clearInterval(countdownInterval);
             countdownInterval = null;
             return;
        }
        
        timerElement.textContent = remaining > 0 ? `${remaining}s` : '0s';
        timerElement.style.color = remaining <= 5 ? 'red' : '#fff';
        
        // የገዙ ካርዶች ብዛት
        const paidCardsCount = bingoReservations.filter(res => res.paid === true && res.roundId === gameStatus.currentRoundId).length;

        if (remaining <= 0) {
            clearInterval(countdownInterval);
            timerElement.textContent = 'የመምረጫ ጊዜ አልቋል!';
            timerElement.style.color = '#cc0000';
            
            // የካርድ መምረጫ ጊዜው ሲያልቅ (0s ሲደርስ)
            if (paidCardsCount >= 2) {
                // ቢያንስ 2 ካርዶች ከተገዙ ጨዋታውን ወደ IN_PROGRESS እናዘዋውራለን
                await db.collection(GAME_COLLECTION).doc('current').update({
                    status: GAME_STATUSES.IN_PROGRESS,
                    timeRemaining: 0, // ጊዜው አልቋል
                    reservationsCount: paidCardsCount // የመጨረሻውን የካርድ ብዛት ያዝ
                });
                alertUser('የመምረጫ ጊዜው አልፏል። ጨዋታው ተጀምሯል።', 'success');
            } else {
                 // 2 ካርዶች ካልተገዙ ወደ WAITING እንመለሳለን
                 await db.collection(GAME_COLLECTION).doc('current').update({
                    status: GAME_STATUSES.WAITING,
                    timeRemaining: 0 
                 });
                 // የተያዙ ካርዶችን እንልቀቅ እና ገንዘብ ተመላሽ እናድርግ
                 bingoReservations.filter(res => res.paid === true && res.roundId === gameStatus.currentRoundId).forEach(res => releaseReservation(res.id, true)); // true ማለት ገንዘብ ይመለስ ማለት ነው
                 selectedCardId = null;
                 alertUser('ቢያንስ 2 ካርዶች ስላልተመረጡ ጨዋታው ተሰርዟል። የተከፈለ ገንዘብ ተመልሷል።', 'error');
            }
             
            // ገጹን ለማደስ
            renderActivePage(); 
        }
        
        if (gameStatus.status === GAME_STATUSES.PRE_GAME) {
             // በ Firestore ላይ ያለውን ጊዜ ማዘመን (ለማመሳሰል)
             db.collection(GAME_COLLECTION).doc('current').update({ timeRemaining: remaining });
        }
        
        remaining--;
    }, 1000);
}


/**
 * *የተስተካከለ*፡ የቢንጎ መጫወቻ ገጽ (ካርድ መምረጥያ)
 */
function renderBingoPage() {
    if (!isLoggedIn) { window.location.hash = '#login-page'; return; }
    
    // ገጹ የሚታየው በ PRE_GAME ወይም WAITING ሁኔታ ውስጥ ብቻ ነው
    if (gameStatus.status !== GAME_STATUSES.PRE_GAME && gameStatus.status !== GAME_STATUSES.WAITING) {
         renderActivePage();
         return;
    }
    
    // የመጫወቻ ካርዱ ከተገዛ የካርድ መምረጫው ይደበቃል (አሁን የሚደበቀው ጨዋታ ሲጀምር ብቻ ነው)
    const myReservation = bingoReservations.find(res => res.userId === currentUser.id && res.paid && res.roundId === gameStatus.currentRoundId);
    
    // የካርዶች ምርጫ HTML ይፍጠሩ
    let cardOptionsHtml = '';
    for (let i = 1; i <= 200; i++) {
        const reservation = bingoReservations.find(res => res.cardId === i && res.roundId === gameStatus.currentRoundId);
        let cardStyle = 'border: 1px solid #ccc; background-color: #fff;';
        let cardClass = 'card-option';
        
        if (reservation && reservation.paid) {
            if (reservation.userId === currentUser.id) {
                cardStyle = 'border: 2px solid #38761d; background-color: #e6ffe6; font-weight: bold;';
                if (!selectedCardId) selectedCardId = i; 
            } else {
                cardStyle = 'border: 2px solid #cc0000; background-color: #ffe6e6; color: #cc0000; cursor: not-allowed;';
                cardClass += ' reserved-other';
            }
        } else if (i === selectedCardId) {
             cardStyle = 'border: 2px solid #38761d; background-color: #e6ffe6; font-weight: bold;';
        }
        
        cardOptionsHtml += `<div id="card-option-${i}" class="${cardClass}" onclick="selectCard(${i})" style="cursor: pointer; padding: 5px; border-radius: 4px; text-align: center; font-size: 0.9em; ${cardStyle}">#${i}</div>`;
    }
    
    const isGameReady = gameStatus.status === GAME_STATUSES.PRE_GAME;
    // *ለውጥ*: ምርጫው የሚጠፋው ጨዋታው IN_PROGRESS ሲሆን ብቻ ነው
    const selectionAreaVisibility = (gameStatus.status === GAME_STATUSES.PRE_GAME) ? 'block' : 'none';
    
    const waitingMessage = `
        <div style="background-color: #ffcccc; color: #cc0000; padding: 15px; border-radius: 8px; margin-bottom: 15px; font-weight: bold;">
             ${gameStatus.status === GAME_STATUSES.WAITING ? 
                'አዲስ ጨዋታ እስኪጀመር በመጠባበቅ ላይ... (አድሚን ካርዶችን ለመሸጥ ሲጀምር ገጹ በራስ-ሰር ይከፈታል)' : 
                'ጨዋታው በሂደት ላይ ነው/አለቀ። እባክዎ ለሚቀጥለው ዙር ይጠብቁ።'}
             ${isAdmin && gameStatus.status === GAME_STATUSES.WAITING ? 
                `<button class="submit-button" style="background-color: #38761d; margin-top: 10px;" onclick="startNewGameRound()">አዲስ ጨዋታ ጀምር</button>` : ''}
        </div>
    `;

    appContainer.innerHTML = `
        <div class="page-container" style="max-width: 700px; margin: 0 auto; text-align: center;">
            <h2><i class="fas fa-dice"></i> የቢንጎ ካርድ መምረጫ</h2>
            
            ${isGameReady ? '' : waitingMessage}
            
            <div style="display: flex; justify-content: space-around; background-color: #004a99; color: white; padding: 10px; border-radius: 8px; margin-bottom: 15px; font-weight: bold;">
                <div style="flex-basis: 30%;">
                    <i class="fas fa-hourglass-half"></i> የመምረጫ ጊዜ <br>
                    <span id="bingo-timer" style="font-size: 1.2em;">${isGameReady ? gameStatus.timeRemaining + 's' : '-'}</span>
                </div>
                <div style="flex-basis: 30%;">
                    <i class="fas fa-wallet"></i> Wallet <br>
                    <span style="font-size: 1.2em; color: #f7b731;">${currentBalance.toFixed(2)} ETB</span>
                </div>
                <div style="flex-basis: 30%;">
                    <i class="fas fa-tag"></i> ዋጋ <br>
                    <span style="font-size: 1.2em; color: #cc0000;">${GAME_STAKE.toFixed(2)} ETB</span>
                </div>
            </div>
            
            <div id="card-selection-container" style="display: ${selectionAreaVisibility}">
                 <h3 style="color: #004a99;">ካርድ ይምረጡ (ክፍያ ወዲያውኑ ይፈጸማል)</h3>
                 ${myReservation ? `<p style="color: #38761d; font-weight: bold;">(ካርድዎን #${myReservation.cardId} ቀይረው ሌላ መግዛት ይችላሉ)</p>` : ''}
                 <p style="font-size: 0.9em; color: #555;">ለመጫወት አንድ ካርድ ላይ ጠቅ ያድርጉ። <span style="color: #cc0000; font-weight: bold;">(ቀይ የሆኑት በሌሎች ተይዘዋል)</span></p>
                 <div id="card-selection-area" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(60px, 1fr)); gap: 5px; max-height: 250px; overflow-y: auto; padding: 10px; border: 1px solid #ddd; border-radius: 6px; background-color: #eee;">
                    ${cardOptionsHtml}
                 </div>
            </div>
            
            <div id="selected-card-display" style="background-color: #f0f0f0; padding: 15px; border-radius: 8px; margin-top: 15px; min-height: 120px; border: 2px dashed #ccc;">
                <p style="color: #888;">ካርድ ሲመርጡ የካርዱ ቁጥሮች እዚህ ይታያሉ።</p>
            </div>
            
            <button onclick="window.location.hash = '#account-page'" class="submit-button" style="background-color: #555; margin-top: 20px;">
                <i class="fas fa-arrow-left"></i> ወደ መለያ ተመለስ
            </button>

            <div id="alert-message-box" style="margin-top: 10px;"></div>
        </div>
    `;
    
    // ቆጣሪውን ማስጀመር
    if (isGameReady) {
       startCountdown(); 
    }
    
    renderCardDisplay();
}

/**
 * አዲስ: የቢንጎ ጨዋታ በሂደት ላይ እያለ የሚያሳይ ገጽ (ያልተቀየረ)
 */
function renderBingoGamePage() {
    if (!isLoggedIn) { window.location.hash = '#login-page'; return; }
    
    // ገጹ የሚታየው በ IN_PROGRESS ሁኔታ ውስጥ ብቻ ነው
    if (gameStatus.status !== GAME_STATUSES.IN_PROGRESS && gameStatus.status !== GAME_STATUSES.COMPLETED) {
         renderActivePage();
         return;
    }
    
    const paidCardsCount = gameStatus.reservationsCount;
    // Derash: (Players * Bet) - 15% Fee = Players * Bet * 0.85
    const derashAmount = paidCardsCount * GAME_STAKE * (1 - FEE_PERCENTAGE); 
    const myReservation = bingoReservations.find(res => res.userId === currentUser.id && res.paid && res.roundId === gameStatus.currentRoundId);
    
    const calledNumbers = gameStatus.calledNumbers || [];
    const currentCall = gameStatus.currentCall !== null ? gameStatus.currentCall : '-';
    
    let myCardHtml = '';
    
    if (myReservation) {
        // የራሱ የተገዛ ካርድ ሲኖር
        const numbers = myReservation.cardNumbers;

        let cardGridHtml = '<div style="display: grid; grid-template-columns: repeat(5, 1fr); max-width: 350px; margin: 0 auto; font-size: 1em; margin-top: 10px;">';
        const letters = ['B', 'I', 'N', 'G', 'O'];
        cardGridHtml += letters.map(l => `<div style="padding: 5px; font-weight: bold; background-color: #004a99; color: white;">${l}</div>`).join('');
        
        numbers.forEach((num) => {
            const isCalled = calledNumbers.includes(num);
            const isFree = num === 'FREE';
            
            let cellStyle = 'background-color: #f9f9f9; color: #333;';
            if (isCalled) {
                cellStyle = 'background-color: #cc0000; color: white; font-weight: bold;'; // የተጠራ ቁጥር በቀይ
            } else if (isFree) {
                cellStyle = 'background-color: #38761d; color: white; font-weight: bold;'; // FREE በአረንጓዴ
            }
            
            cardGridHtml += `<div style="padding: 10px; border: 1px solid #aaa; ${cellStyle}">${num}</div>`;
        });
        
        cardGridHtml += '</div>';

        myCardHtml = `
            <h3 style="color: #004a99;">የእርስዎ የተገዛ ካርድ #${myReservation.cardId}</h3>
            ${cardGridHtml}
            <button class="submit-button" style="background-color: #cc0000; margin-top: 15px;" onclick="checkBingo()">
                <i class="fas fa-trophy"></i> ቢንጎ! (አረጋግጥ)
            </button>
        `;
    } else {
        myCardHtml = `<p style="color: #cc0000; font-weight: bold;">ለዚህ ዙር ካርድ አልገዙም። ጨዋታው እስኪጠናቀቅ ይጠብቁ።</p>`;
    }
    
    const gameFinishedMessage = `
         <div style="background-color: #38761d; color: white; padding: 15px; border-radius: 8px; margin-top: 20px;">
             <h3 style="color: white; margin: 0;">ጨዋታው ተጠናቋል!</h3>
             <p style="margin: 5px 0 0;">${gameStatus.currentCall === 'WINNER DECLARED' ? 'አሸናፊው ታውቋል!' : 'ጨዋታው ተጠናቋል'}</p>
         </div>
    `;
    
    // የተጠሩ ቁጥሮች ዝርዝር (1-75)
    let allNumbersHtml = '<div style="display: flex; flex-wrap: wrap; max-width: 500px; margin: 15px auto; border: 1px solid #ccc; padding: 10px; border-radius: 8px; background-color: #f0f0f0;">';
    ALL_BINGO_NUMBERS.forEach(num => {
        const isCalled = calledNumbers.includes(num);
        const style = isCalled ? 
            'background-color: #cc0000; color: white; font-weight: bold;' : 
            'background-color: #fff; color: #333;';
        
        allNumbersHtml += `<div style="width: 8%; padding: 3px 0; margin: 2px; text-align: center; border-radius: 3px; font-size: 0.8em; ${style}">${num}</div>`;
    });
    allNumbersHtml += '</div>';


    appContainer.innerHTML = `
        <div class="page-container" style="max-width: 700px; margin: 0 auto; text-align: center; background-color: #f7f7f7; padding: 20px; border-radius: 10px;">
            <h2><i class="fas fa-bullhorn"></i> ቢንጎ - ቀጥታ ጨዋታ</h2>
            
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background-color: #004a99; color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <div style="padding: 5px;">
                    <span style="font-size: 0.9em; font-weight: normal;">ደርሻ</span><br>
                    <span style="font-size: 1.4em; font-weight: bold; color: #f7b731;">${derashAmount.toFixed(2)}</span>
                </div>
                <div style="padding: 5px;">
                    <span style="font-size: 0.9em; font-weight: normal;">ተጫዋቾች</span><br>
                    <span style="font-size: 1.4em; font-weight: bold;">${paidCardsCount}</span>
                </div>
                <div style="padding: 5px;">
                    <span style="font-size: 0.9em; font-weight: normal;">Bet</span><br>
                    <span style="font-size: 1.4em; font-weight: bold;">${GAME_STAKE.toFixed(2)}</span>
                </div>
                <div style="padding: 5px;">
                    <span style="font-size: 0.9em; font-weight: normal;">ጥሪ</span><br>
                    <span id="call-count" style="font-size: 1.4em; font-weight: bold;">${calledNumbers.length}</span>
                </div>
            </div>
            
            <div style="background-color: #9933cc; color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: center; align-items: center;">
                 <span style="font-size: 1.1em; font-weight: bold; margin-right: 15px;">አሁን የተጠራው ቁጥር:</span>
                 <span id="current-call-display" style="font-size: 2.5em; font-weight: bold; background-color: #551a8b; padding: 5px 15px; border-radius: 5px;">${currentCall}</span>
            </div>
            
            <div id="player-card-area" style="background-color: #fff; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #ddd;">
                ${gameStatus.status === GAME_STATUSES.COMPLETED ? gameFinishedMessage : myCardHtml}
            </div>
            
            ${gameStatus.status === GAME_STATUSES.COMPLETED ? `
                <div style="background-color: #ffcc00; color: #333; padding: 10px; border-radius: 6px; margin-top: 15px;">
                    <i class="fas fa-hourglass-start"></i> እባክዎ ለቀጣዩ ጨዋታ ለመዘጋጀት ይጠብቁ...
                </div>
            ` : ''}

            <h3 style="color: #333; margin-top: 20px;">እስካሁን የተጠሩ ቁጥሮች (1-75)</h3>
            ${allNumbersHtml}
            
            <button onclick="window.location.hash = '#account-page'" class="submit-button" style="background-color: #555; margin-top: 20px;">
                <i class="fas fa-arrow-left"></i> ወደ መለያ ተመለስ
            </button>
            
            ${isAdmin ? `
                <div style="margin-top: 20px; border: 2px solid orange; padding: 10px; border-radius: 8px;">
                    <h4 style="color: orange;">አድሚን መቆጣጠሪያ ፓናል</h4>
                    ${gameStatus.status === GAME_STATUSES.IN_PROGRESS ? `
                        <button class="submit-button" style="background-color: #004a99; margin-right: 10px;" onclick="callNextNumber()">
                            <i class="fas fa-plus"></i> ቀጣዩን ቁጥር ጥራ
                        </button>
                        <button class="submit-button" style="background-color: #cc0000;" onclick="declareWinner()">
                            <i class="fas fa-trophy"></i> አሸናፊውን አሳውቅ
                        </button>
                    ` : gameStatus.status === GAME_STATUSES.COMPLETED ? `
                         <button class="submit-button" style="background-color: #38761d;" onclick="startNewGameRound()">
                            <i class="fas fa-play"></i> አዲስ ዙር ጀምር
                        </button>
                    ` : gameStatus.status === GAME_STATUSES.WAITING ? `
                        <button class="submit-button" style="background-color: #38761d;" onclick="startNewGameRound()">
                            <i class="fas fa-play"></i> አዲስ ካርድ መምረጫ ጀምር
                        </button>
                    ` : ''}
                </div>
            ` : ''}

            <div id="alert-message-box" style="margin-top: 10px;"></div>
        </div>
    `;
}

// ===========================================
// አድሚን ተግባራት (በጨዋታ ገጽ ላይ የሚፈለጉ)
// ===========================================

/**
 * አድሚን ብቻ: አዲስ ዙር የሚጀምር ተግባር
 */
async function startNewGameRound() {
    if (!isAdmin) return;
    
    // የቀድሞ reservation ን ሙሉ በሙሉ ያጽዱ
    // (በቀድሞው ዙር የተገዙ ካርዶች ለቀጣዩ ዙር ትክክለኛ አይደሉም)
    const oldReservations = bingoReservations.filter(res => res.roundId === gameStatus.currentRoundId);
    oldReservations.forEach(res => db.collection('bingoReservations').doc(res.id).delete());
    selectedCardId = null;
    
    // አዲስ ዙር መረጃ ፍጠር (ወደ PRE_GAME)
    try {
        await db.collection(GAME_COLLECTION).doc('current').set({
            status: GAME_STATUSES.PRE_GAME,
            currentRoundId: new Date().getTime(),
            timeRemaining: PRE_GAME_SECONDS,
            calledNumbers: [],
            currentCall: null,
            reservationsCount: 0 
        });
        
        alertUser('አዲስ የካርድ መምረጫ ዙር ተጀምሯል።', 'info');
        renderActivePage();

    } catch(e) {
        console.error("Error starting new round:", e);
        alertUser('አዲስ ዙር ማስጀመር አልተቻለም።', 'error');
    }
}

/**
 * አድሚን ብቻ: ቀጣዩን ቁጥር የሚጠራ ተግባር
 */
async function callNextNumber() {
    if (!isAdmin || gameStatus.status !== GAME_STATUSES.IN_PROGRESS) return;
    
    const currentCalled = gameStatus.calledNumbers || [];
    // ገና ያልተጠሩ ቁጥሮችን አጣራ
    const remainingNumbers = ALL_BINGO_NUMBERS.filter(num => !currentCalled.includes(num));
    
    if (remainingNumbers.length === 0) {
        alertUser('ሁሉም ቁጥሮች ተጠርተዋል።', 'error');
        return;
    }
    
    // በዘፈቀደ አንድ ቁጥር ምረጥ
    const randomIndex = Math.floor(Math.random() * remainingNumbers.length);
    const nextNumber = remainingNumbers[randomIndex];
    
    // ሁኔታውን በ Firestore ላይ አዘምን
    try {
        await db.collection(GAME_COLLECTION).doc('current').update({
            calledNumbers: firebase.firestore.FieldValue.arrayUnion(nextNumber),
            currentCall: nextNumber
        });
        alertUser(`ቁጥር ${nextNumber} ተጠርቷል።`, 'success');
    } catch (e) {
        console.error("Error calling next number:", e);
        alertUser('ቁጥሩን በመጥራት ላይ ስህተት ተፈጠረ።', 'error');
    }
}

/**
 * አድሚን ብቻ: ጨዋታውን የሚጨርስ ተግባር
 */
async function declareWinner() {
    if (!isAdmin || gameStatus.status !== GAME_STATUSES.IN_PROGRESS) return;
    
    if (!await customConfirm('እርግጠኛ ነዎት ጨዋታው አሸናፊ አግኝቶ ተጠናቋል?')) { return; }
    
    try {
        // ሁኔታውን ወደ COMPLETED ቀይር
        await db.collection(GAME_COLLECTION).doc('current').update({
            status: GAME_STATUSES.COMPLETED,
            currentCall: 'WINNER DECLARED'
            // የሽልማት ክፍያ ሎጂክ እዚህ ይጨመራል
        });
        
        alertUser('ጨዋታው ተጠናቋል። አሸናፊው ተገልጿል።', 'success');
        
        // አሸናፊው ከተገለጸ በኋላ ወደ WAITING ሁኔታ ይቀየርና አዲስ ዙር ይጀምራል
        setTimeout(async () => {
             // አድሚን እስኪጀምር ድረስ ወደ WAITING ይልካል
             await db.collection(GAME_COLLECTION).doc('current').update({
                status: GAME_STATUSES.WAITING,
                timeRemaining: 0,
                currentCall: 'WAITING'
             });
             renderActivePage(); // ገጹን አዘምን
        }, 5000); // ለ 5 ሰከንድ ያህል ውጤቱን አሳይ
        
    } catch (e) {
        console.error("Error declaring winner:", e);
        alertUser('አሸናፊውን በማሳወቅ ላይ ስህተት ተፈጠረ።', 'error');
    }
}

// ===========================================
// ሌላ ቦታ ያልተለወጡ functions
// ===========================================

function renderUserListPage() {
     // ... (የተጠቃሚ ዝርዝር ገጽ - ሳይቀየር ቀርቷል)
     if (!isAdmin) { 
        window.location.hash = '#account-page'; 
        return; 
    }
    
    const usersHtml = allUsers.filter(u => u.phone !== adminTelebirrPhone).map(user => `
        <li style="border: 1px solid #ccc; padding: 10px; margin-bottom: 8px; border-radius: 4px; background-color: #f9f9f9; text-align: left;">
            <strong>ስም:</strong> ${user.name}<br>
            <strong>ስልክ ቁጥር:</strong> ${user.phone}<br>
            <strong>ቀሪ ሂሳብ:</strong> ETB ${user.balance.toFixed(2)}<br>
            <strong>ኮድ:</strong> ${user.referralCode}
        </li>
    `).join('');
    
    appContainer.innerHTML = `
        <div class="page-container">
            <h2><i class="fas fa-users"></i> የተመዘገቡ ተጠቃሚዎች ዝርዝር</h2>
            <p>ጠቅላላ ተጠቃሚዎች (ከአድሚን ውጪ): ${allUsers.length - 1}</p>
            <ul style="list-style-type: none; padding: 0; text-align: left; margin-top: 15px;">
                ${usersHtml.length > 0 ? usersHtml : '<p>የተመዘገቡ ተጠቃሚዎች የሉም።</p>'}
            </ul>
            <button onclick="window.location.hash = '#account-page'" class="submit-button" style="background-color: #aaa; margin-top: 20px;">ተመለስ</button>
            <div id="alert-message-box" style="margin-top: 10px;"></div>
        </div>
    `;
}

function renderAccountPage() {
    // ... (የመለያ ገጽ - ሳይቀየር ቀርቷል)
    if (!isLoggedIn || !currentUser) { window.location.hash = '#login-page'; return; }
    
    const updatedUser = allUsers.find(u => u.phone === currentUser.phone);
    if (updatedUser) {
        currentUser = updatedUser;
        currentBalance = updatedUser.balance;
    }

    function getConfirmButton(req, type) {
        if (isAdmin) {
            const buttonStyle = type === 'recharge' ? "background-color: #38761d;" : "background-color: #004a99;";
            const action = type === 'recharge' ? `confirmRecharge('${req.id}', ${req.amount}, '${req.userPhone}')` : `confirmWithdrawal('${req.id}')`;
            const label = type === 'recharge' ? 'ገቢ አረጋግጥ' : 'ክፍያ አረጋግጥ';
             return `<button onclick="${action}" class="admin-action-btn" style="${buttonStyle} color: white;">${label}</button>`;
        }
        return '<span style="color: red; font-weight: bold; margin-top: 5px; display: block;">በመጠባበቅ ላይ...</span>';
    }
    
    const userRecharges = pendingRecharges.filter(req => isAdmin || req.userPhone === currentUser.phone);
    const userWithdrawals = pendingWithdrawals.filter(req => isAdmin || req.userPhone === currentUser.phone);
    
    const pendingRechargeHtml = userRecharges.length > 0 ? `<h3 style="margin-top: 20px; color: #cc0000;"><i class="fas fa-clock"></i> በመጠባበቅ ላይ ያሉ ገቢዎች (${userRecharges.length}):</h3><ul style="list-style-type: none; padding: 0;">${userRecharges.map(req => {
        return `<li style="border: 1px dashed #ffcc00; padding: 10px; margin-bottom: 5px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;"><div style="flex-grow: 1; text-align: left;"><strong>+${req.amount.toFixed(2)} ETB</strong> - ID: <span style="font-weight: bold; color: #004a99;">${req.transactionId}</span>${isAdmin ? `<br><span style="font-size: 0.9em; color: #008080;">ለ: ${req.userPhone}</span>` : ''}<br><span style="font-size: 0.8em; color: #888;">ጥያቄ የላኩበት: ${req.date}</span></div>${getConfirmButton(req, 'recharge')}</li>`; }).join('')}</ul>` : '';
    
    const pendingWithdrawalHtml = userWithdrawals.length > 0 ? `<h3 style="margin-top: 20px; color: #9933cc;"><i class="fas fa-hourglass-half"></i> በመጠባበቅ ላይ ያሉ ገንዘብ ማውጫዎች (${userWithdrawals.length}):</h3><ul style="list-style-type: none; padding: 0;">${userWithdrawals.map(req => {
        return `<li style="border: 1px dashed #9933cc; padding: 10px; margin-bottom: 5px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;"><div style="flex-grow: 1; text-align: left;"><strong>-ETB ${req.amount.toFixed(2)}</strong> (${req.bank})<br>${isAdmin ? `<span style="font-size: 0.9em; color: #008080;">ለ: ${req.accountName} (${req.account})</span><br>` : ''}<span style="font-size: 0.8em; color: #888;">ጥያቄ የላኩበት: ${req.date}</span></div>${getConfirmButton(req, 'withdraw')}</li>`; }).join('')}</ul>` : '';
    
    const adminUserListButton = isAdmin ? 
        `<button class="submit-button" style="background-color: #38761d; color: white; margin-top: 10px;" onclick="window.location.hash = '#user-list-page'">
            <i class="fas fa-users"></i> የተመዘገቡ ተጠቃሚዎችን ዝርዝር እይ
        </button>` : '';
        
    const adminNote = isAdmin ? 
        `<p style="font-size: 0.9em; color: #004a99; font-weight: bold; margin-top: 10px;">**ማሳሰቢያ:** አዲስ ጥያቄ ሲደርስዎ ገጹ በራስ-ሰር (Real-time) ይዘምናል።</p>` : '';
        
    appContainer.innerHTML = `
        <div class="page-container">
            <h2><i class="fas fa-user-circle"></i> የኔ መለያ ${isAdmin ? ' (Admin)' : ''}</h2>
            <div class="account-info">
                <h3>የግል መለያ መረጃ:</h3>
                <p><strong>ስልክ ቁጥር:</strong> ${currentUser.phone}</p>
                <p><strong>መታወቂያ (ID):</strong> ${currentUser.id}</p>
                <p><strong>የተመዘገበበት ስም:</strong> ${currentUser.name}</p>
                <p class="referral-code-info">
                    <strong>የእርስዎ መጋበዣ ኮድ:</strong> 
                    <span id="my-referral-code" style="font-weight: bold; color: #004a99; cursor: pointer;" onclick="copyReferralCode('${currentUser.referralCode}')">${currentUser.referralCode || 'አልተሰጠም'} <i class="fas fa-copy"></i></span>
                </p>
                <p id="copy-message" style="color: green; font-size: 0.9em; margin-top: 5px; display: none; text-align: center;">ኮዱ ተቀድቷል!</p>
                <h3 style="margin-top: 15px;">የቀሪ ሂሳብዎ:</h3>
                <p class="balance">ETB ${currentBalance.toFixed(2)}</p>
                <div class="btn-group">
                    <button class="btn-recharge" onclick="window.location.hash = '#recharge-form-page'"><i class="fas fa-plus-circle"></i> ገንዘብ አስገባ</button>
                    <button class="btn-withdraw" onclick="window.location.hash = '#withdraw-form-page'"><i class="fas fa-minus-circle"></i> ገንዘብ አውጣ</button>
                </div>
            </div>
            
            ${adminUserListButton} 
            ${adminNote}
            
            <div class="transaction-section">
                <h3><i class="fas fa-history"></i> የግብይት ታሪክ (ጥያቄዎች):</h3>
                ${pendingRechargeHtml}
                ${pendingWithdrawalHtml}
            </div>
            
            <button class="submit-button" style="background-color: #cc0000; color: white; margin-top: 20px;" onclick="handleLogout()">
                <i class="fas fa-sign-out-alt"></i> ውጣ
            </button>
            
            <button class="submit-button" style="background-color: #555; color: white; margin-top: 10px;" onclick="window.location.hash = '#change-password-page'">
                <i class="fas fa-key"></i> የይለፍ ቃል ቀይር
            </button>
            <div id="alert-message-box" style="margin-top: 10px;"></div>
        </div>`;
}

function handleLogout(showAlert = true) {
    // ... (የመውጫ ተግባር - ሳይቀየር ቀርቷል)
    isLoggedIn = false;
    isAdmin = false;
    currentUser = null;
    currentBalance = 0.00; 
    
    localStorage.removeItem('currentUserPhone');
    
    // ከቢንጎ ገጽ ሲወጡ የነበረውን reservation ይልቀቁ
    // ገንዘብ ተመላሽ አይደረግም ምክንያቱም አንዴ ከተከፈለ ወስኗል
    if (selectedCardId && (window.location.hash === '#bingo-page' || window.location.hash === '#bingo-game-page')) {
        // releaseReservation(bingoReservations.find(res => res.cardId === selectedCardId && res.roundId === gameStatus.currentRoundId)?.id, false);
        selectedCardId = null;
    }
    
    if (showAlert) {
         alertUser('ከመለያዎ ወጥተዋል::', 'info');
    }
    renderActivePage();
    window.location.hash = '#login-page';
}

// Custom Utility Functions (ሳይቀየሩ ቀርተዋል)
function alertUser(message, type = 'info') {
    // ... (Custom Alert Box - ሳይቀየር ቀርቷል)
    const box = document.getElementById('alert-message-box');
    if (!box) return;

    let bgColor = '#e6f7ff'; 
    let textColor = '#004a99';

    if (type === 'error') {
        bgColor = '#ffe6e6';
        textColor = '#cc0000';
    } else if (type === 'success') {
        bgColor = '#e6ffe6';
        textColor = '#38761d';
    }

    box.innerHTML = `<div style="padding: 10px; border-radius: 8px; background-color: ${bgColor}; color: ${textColor}; margin: 10px 0; border: 1px solid ${textColor}; font-weight: bold;">${message}</div>`;
    
    setTimeout(() => {
        box.innerHTML = '';
    }, 4000);
}

function customConfirm(message) {
    // ... (Custom Confirm Box - ሳይቀየር ቀርቷል)
    return new Promise(resolve => {
        const box = document.getElementById('alert-message-box');
        if (!box) {
             resolve(window.confirm(message)); 
             return;
        }

        box.innerHTML = `
            <div style="padding: 15px; border-radius: 8px; background-color: #fff; color: #333; margin: 10px 0; border: 2px solid #004a99; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
                <p style="font-weight: bold; margin-top: 0;">${message}</p>
                <div style="display: flex; justify-content: space-around; gap: 10px;">
                    <button id="confirm-yes" style="flex-grow: 1; padding: 10px; background-color: #38761d; color: white; border: none; border-radius: 6px; cursor: pointer;">አዎ</button>
                    <button id="confirm-no" style="flex-grow: 1; padding: 10px; background-color: #cc0000; color: white; border: none; border-radius: 6px; cursor: pointer;">አይ</button>
                </div>
            </div>
        `;
        
        document.getElementById('confirm-yes').onclick = () => {
            box.innerHTML = '';
            resolve(true);
        };
        document.getElementById('confirm-no').onclick = () => {
            box.innerHTML = '';
            resolve(false);
        };
    });
}

function updateCardColors() {
    // ... (የካርድ ቀለም ማዘመኛ ተግባር - ሳይቀየር ቀርቷል)
    for (let i = 1; i <= 200; i++) {
        const cardElement = document.getElementById(`card-option-${i}`);
        if (!cardElement) continue;

        const reservation = bingoReservations.find(res => res.cardId === i && res.roundId === gameStatus.currentRoundId);
        let cardStyle = 'border: 1px solid #ccc; background-color: #fff; color: #333; cursor: pointer;';
        
        if (reservation && reservation.paid) {
            if (reservation.userId === currentUser.id) {
                cardStyle = 'border: 2px solid #38761d; background-color: #e6ffe6; font-weight: bold; color: #333; cursor: pointer;'; // *ለውጥ*: አሁንም ጠቅ ማድረግ እንዲችል
            } else {
                cardStyle = 'border: 2px solid #cc0000; background-color: #ffe6e6; color: #cc0000; cursor: not-allowed;';
            }
            cardElement.setAttribute('onclick', `selectCard(${i})`); // *ለውጥ*: የመምረጥ ተግባር እንዲሰራ
        } else {
             cardElement.setAttribute('onclick', `selectCard(${i})`);
        }
        
        cardElement.style.cssText = `padding: 5px; border-radius: 4px; text-align: center; font-size: 0.9em; ${cardStyle}`;
    }
}


// ----------------------------------------------------
// 10. ጅምር (Initialization)
// ----------------------------------------------------

function initializeApp() {
    // 1. የክፍለ ጊዜ ማረጋገጫ
    const savedPhone = localStorage.getItem('currentUserPhone');
    if (savedPhone) {
        currentUser = allUsers.find(u => u.phone === savedPhone);
        if (currentUser) {
            isLoggedIn = true;
            isAdmin = (currentUser.phone === adminTelebirrPhone);
        } else {
             localStorage.removeItem('currentUserPhone');
        }
    }
    
    // 2. Real-time Listenersን ማስጀመር
    listenToUsers(); 
    listenToRecharges(); 
    listenToWithdrawals(); 
    listenToReservations(); // የካርድ መያዣዎችን ያድምጡ
    listenToGameStatus(); // አዲስ: የጨዋታውን ሁኔታ ያድምጡ

    // 3. የገጽ ለውጦችን መከታተል
    window.addEventListener('hashchange', () => {
        // ከቢንጎ ገጽ ሲወጣ ቆጣሪውን ያቁሙ
        if (window.location.hash !== '#bingo-page' && countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        renderActivePage();
    });
    
    // ጅምር ላይ የቆጣሪውን ጊዜ ማዘጋጀት
    if (gameStatus.status === GAME_STATUSES.PRE_GAME && gameStatus.timeRemaining === 0) {
        // የመጨረሻውን የጊዜ ዋጋ ከ Firestore ያግኙ
        db.collection(GAME_COLLECTION).doc('current').get().then(doc => {
             if (doc.exists && doc.data().timeRemaining > 0) {
                 gameStatus.timeRemaining = doc.data().timeRemaining;
             } else {
                 db.collection(GAME_COLLECTION).doc('current').update({ timeRemaining: PRE_GAME_SECONDS });
             }
        });
    }

    renderActivePage(); 
}

// ኮዱ ከወረደ በኋላ ያስጀምራል
window.addEventListener('load', initializeApp);

// ግሎባል ውስጥ ያሉ ተግባራትን ይፋ ያድርጉ
window.selectCard = selectCard;
window.handleLogout = handleLogout;
window.copyReferralCode = copyReferralCode;
window.confirmRecharge = confirmRecharge;
window.confirmWithdrawal = confirmWithdrawal;

// ለአድሚን መቆጣጠሪያ
window.callNextNumber = callNextNumber;
window.declareWinner = declareWinner;
window.startNewGameRound = startNewGameRound;