// =================================================================
// ETHIO BINGO - FIREBASE FIRESTORE IMPLEMENTATION
// ችግር ፈቺ: Local Storageን በ Real-time Shared Database (Firestore) መተካት
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

// የዳታቤዝ Collections - (በገጽ ጫና ላይ በ onSnapshot የሚሞሉ)
let allUsers = []; 
let pendingRecharges = []; 
let pendingWithdrawals = []; 

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

/**
 * የገንዘብ ማስገቢያ ጥያቄዎችን Real-time የሚከታተል ተግባር
 */
function listenToRecharges() {
    return db.collection('recharges').where('status', '==', 'Pending').onSnapshot(snapshot => {
        pendingRecharges = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // አድሚኖች የሌላ ሰው ጥያቄ ወዲያውኑ እንዲያዩ ገጹን ያድሳል
        if (isAdmin) {
             renderActivePage();
        }
    }, error => {
        console.error("Error listening to recharges:", error);
    });
}

/**
 * የገንዘብ ማውጫ ጥያቄዎችን Real-time የሚከታተል ተግባር
 */
function listenToWithdrawals() {
    return db.collection('withdrawals').where('status', '==', 'Pending').onSnapshot(snapshot => {
        pendingWithdrawals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // አድሚኖች የሌላ ሰው ጥያቄ ወዲያውኑ እንዲያዩ ገጹን ያድሳል
        if (isAdmin) {
            renderActivePage();
        }
    }, error => {
        console.error("Error listening to withdrawals:", error);
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
        // Alertን መጠቀም አይፈቀድም - በምትኩ መልዕክት በገጹ ላይ አሳዩ
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

// ከ Firestore ላይ ያሉትን ወቅታዊ ዳታዎች በመጠቀም ገጹን ያድሳል
function renderActivePage() {
    const hash = window.location.hash;
    renderNavbar(); 

    if (!isLoggedIn && hash !== '#register-page') {
        renderLoginPage();
        return;
    }
    
    // የገጽ አሳሽ
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
    } else {
        renderRegisterPage();
    }
}


function renderNavbar() {
    if (!navContainer) return; 
    let navHtml = '';
    const currentHash = window.location.hash;
    
    const balanceDisplay = isLoggedIn ? 
        `<span style="margin-left: 10px; padding: 5px 10px; background-color: #f7b731; color: #333; border-radius: 5px; font-weight: bold;">Wallet: ETB ${currentBalance.toFixed(2)}</span>` : '';

    if (isLoggedIn) {
        navHtml = `
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
            <a href="#register-page" class="${currentHash === '#register-page' || currentHash === '' ? 'active' : ''}">
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
// 5. የአካውንት አስተዳደር ፋንክሽኖች
// ----------------------------------------------------

async function handleRegistration(e) {
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
                
                // ጋባዡን በ Firestore ላይ ማዘመን
                await db.collection('users').doc(referrer.id).update({
                    balance: firebase.firestore.FieldValue.increment(rewardAmount)
                });
                rewardMessage = `እና ጋባዥዎ (${referrer.name}) በ ${rewardAmount.toFixed(2)} ETB ሽልማት አግኝተዋል።`;
            } else if (referrer && referrer.phone === phone) { alertUser("የራስዎን ስልክ ቁጥር ወይም ኮድ መጠቀም አይችሉም!", 'error'); } 
            else { alertUser("ያስገቡት የመጋበዣ ኮድ ትክክል አይደለም።", 'error'); }
        }
        
        // አዲሱን ተጠቃሚ ወደ Firestore ማስገባት
        await db.collection('users').add(newUser);
        
        alertUser(`በተሳካ ሁኔታ ተመዝግበዋል! አሁን መግባት ይችላሉ። ${rewardMessage}`, 'success');
        window.location.hash = '#login-page'; 

    } catch (e) {
        console.error("Error during registration:", e);
        alertUser('በምዝገባ ወቅት ችግር ተፈጥሯል። እባክዎ እንደገና ይሞክሩ።', 'error');
    }
}

function renderRegisterPage() {
    appContainer.innerHTML = `<div class="page-container"><h2>አዲስ መለያ ይክፈቱ</h2><form id="register-form"><div class="form-group"><label for="reg-name"><i class="fas fa-user"></i> ስምዎን ያስገቡ:</label><input type="text" id="reg-name" name="name" placeholder="ሙሉ ስምዎን ያስገቡ" required></div><div class="form-group"><label for="reg-phone"><i class="fas fa-phone"></i> ስልክ ቁጥር:</label><input type="tel" id="reg-phone" name="phone" placeholder="ለምሳሌ: 09..." required></div><div class="form-group"><label for="reg-password"><i class="fas fa-lock"></i> የይለፍ ቃል:</label><input type="password" id="reg-password" name="password" required></div><div class="form-group"><label for="reg-confirm-password"><i class="fas fa-check-lock"></i> የይለፍ ቃል አረጋግጥ:</label><input type="password" id="reg-confirm-password" name="confirm_password" required></div><div class="form-group"><label for="reg-invite"><i class="fas fa-user-plus"></i> የመጋበዣ ኮድ (አማራጭ):</label><input type="text" id="reg-invite" name="invite_code" placeholder="ጋባዥ ካለ ኮዱን ያስገቡ"></div><button type="submit" class="submit-button">መዝግብ</button><p style="margin-top: 15px;">መለያ አለዎት? <a href="#login-page">ይግቡ</a></p><div id="alert-message-box" style="margin-top: 10px;"></div></form></div>`;
    document.getElementById('register-form').addEventListener('submit', handleRegistration);
}

function handleLogin(e) {
    e.preventDefault();
    
    const phone = document.getElementById('log-phone').value;
    const password = document.getElementById('log-password').value;
    
    const userFound = allUsers.find(user => user.phone === phone && user.password === password);
    
    if (userFound) {
        currentUser = userFound;
        currentBalance = currentUser.balance; 
        isAdmin = (phone === adminTelebirrPhone);
        isLoggedIn = true;
        
        // ክፍለ ጊዜውን በ Local Storage ማቆየት (ከሌላ ስልክ ጋር ግንኙነት የለውም)
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
    appContainer.innerHTML = `<div class="page-container"><h2>ወደ መለያዎ ይግቡ</h2><form id="login-form"><div class="form-group"><label for="log-phone"><i class="fas fa-phone"></i> ስልክ ቁጥር:</label><input type="tel" id="log-phone" name="phone" required></div><div class="form-group"><label for="log-password"><i class="fas fa-lock"></i> የይለፍ ቃል:</label><input type="password" id="log-password" name="password" required></div><button type="submit" class="submit-button">ግባ</button></form><p style="margin-top: 15px;">አዲስ ነዎት? <a href="#register-page">ይመዝገቡ</a></p><div id="alert-message-box" style="margin-top: 10px;"></div></div>`;
    document.getElementById('login-form').addEventListener('submit', handleLogin);
}

// ----------------------------------------------------
// 6. የግብይት ፋንክሽኖች
// ----------------------------------------------------

function renderRechargeFormPage() {
    if (!isLoggedIn) { window.location.hash = '#login-page'; return; }
    appContainer.innerHTML = `<div class="page-container"><h2><i class="fas fa-plus-circle"></i> ገንዘብ አስገባ (Recharge)</h2><div class="account-info" style="text-align: center;"><p style="font-size: 1.1em; font-weight: bold; color: #cc0000;">**መጀመሪያ ገንዘቡን ይላኩ!**</p><p>ገንዘቡን ወደሚከተለው የቴሌብር ቁጥር ይላኩ፡</p><p style="font-size: 1.4em; color: #004a99; font-weight: bold;"><i class="fas fa-mobile-alt"></i> ${adminTelebirrPhone} (${adminTelebirrName})</p><p style="margin-top: 15px; font-weight: bold;">ገንዘቡን ከላኩ በኋላ የሚከተለውን ቅፅ ይሙሉ።</p></div><form id="recharge-form" style="margin-top: 20px;"><div class="form-group"><label for="recharge-amount"><i class="fas fa-money-bill-wave"></i> የገንዘብ መጠን (ETB):</label><input type="number" id="recharge-amount" required min="10"></div><div class="form-group"><label for="transaction-id"><i class="fas fa-key"></i> የግብይት መለያ ቁጥር (Transaction ID):</label><input type="text" id="transaction-id" placeholder="ገንዘብ ከላኩ በኋላ የሚደርስዎትን ID ያስገቡ" required></div><button type="submit" class="submit-button btn-recharge">ጥያቄ ላክ</button></form><button onclick="window.location.hash = '#account-page'" class="submit-button" style="background-color: #aaa; margin-top: 10px;">ተመለስ</button><div id="alert-message-box" style="margin-top: 10px;"></div></div>`;
    document.getElementById('recharge-form').addEventListener('submit', handleRechargeRequest);
}
async function handleRechargeRequest(e) {
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
        // ጥያቄውን ወደ Firestore ማስገባት
        await db.collection('recharges').add(request); 
        alertUser(`የ ETB ${numAmount.toFixed(2)} ማስገቢያ ጥያቄዎ በተሳካ ሁኔታ ተልኳል።`, 'success');
        window.location.hash = '#account-page';
    } catch (e) {
         console.error("Error sending recharge request:", e);
         alertUser('ጥያቄውን በመላክ ላይ ስህተት ተፈጥሯል።', 'error');
    }
}

async function confirmRecharge(requestId, amount, userPhone) {
    if (!isAdmin) { return; } 

    // Custom Confirmation Dialog (Replacing alert/confirm)
    if (!await customConfirm(`ይህንን የ ${amount.toFixed(2)} ETB ገቢ በእርግጥ ለተጠቃሚ ${userPhone} ማረጋገጥ ይፈልጋሉ?`)) { return; }
    
    const targetUser = allUsers.find(user => user.phone === userPhone);
    
    if (!targetUser) { alertUser(`ስልክ ቁጥር ${userPhone} ያለው ተጠቃሚ አልተገኘም!`, 'error'); return; }

    try {
        // 1. የተጠቃሚውን ሂሳብ ማዘመን
        await db.collection('users').doc(targetUser.id).update({
            balance: firebase.firestore.FieldValue.increment(amount)
        });

        // 2. የጥያቄውን ሁኔታ ወደ 'Confirmed' በመቀየር ማስወገድ
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
    e.preventDefault();

    const bank = document.getElementById('withdraw-bank').value;
    const account = document.getElementById('withdraw-account').value.trim();
    const name = document.getElementById('withdraw-name').value.trim();
    const amount = document.getElementById('withdraw-amount').value;
    const numAmount = parseFloat(amount);
    
    if (numAmount < 10) { alertUser("ቢያንስ 10 ETB ማውጣት አለብዎት።", 'error'); return; }
    
    // የቅርብ ጊዜውን የተጠቃሚ መረጃ ከ allUsers ማግኘት
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
        // 1. የገንዘብ ማውጫ ጥያቄውን ወደ Firestore ማስገባት
        await db.collection('withdrawals').add(request); 
        
        // 2. የተጠቃሚውን ሂሳብ መቀነስ
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
    if (!isAdmin) { return; }

    const request = pendingWithdrawals.find(req => req.id === requestId);
    if (!request) { alertUser("ይህ የማውጫ ጥያቄ አልተገኘም!", 'error'); return; }
    
    // Custom Confirmation Dialog (Replacing alert/confirm)
    if (!await customConfirm(`ገንዘቡን ለተጠቃሚው ${request.userPhone} ወደ ${request.bank} አካውንት ${request.account} አስተላልፈዋል?`)) { return; }

    try {
        // ጥያቄውን ሁኔታውን ወደ 'Confirmed' በመቀየር ማስወገድ
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
    if (!isLoggedIn || !currentUser) { window.location.hash = '#login-page'; return; }
    appContainer.innerHTML = `<div class="page-container"><h2><i class="fas fa-minus-circle"></i> ገንዘብ አውጣ (Withdraw)</h2><div class="account-info" style="margin-bottom: 20px;"><p>አሁን ያለዎት ቀሪ ሂሳብ: **ETB ${currentBalance.toFixed(2)}**</p></div><form id="withdraw-form" style="margin-top: 20px;"><div class="form-group"><label for="withdraw-bank"><i class="fas fa-university"></i> ገንዘብ የሚላክበት ባንክ:</label><select id="withdraw-bank" name="bank" required><option value="">-- ባንክ ይምረጡ --</option><option value="CBE">ንግድ ባንክ (CBE)</option><option value="Abyssinia">አቢሲኒያ ባንክ</option><option value="Dashen">ዳሽን ባንክ</option><option value="Telebirr">ቴሌብር</option><option value="Awash">አዋሽ ባንክ</option></select></div><div class="form-group"><label for="withdraw-account"><i class="fas fa-wallet"></i> የባንክ ሂሳብ/ስልክ ቁጥር:</label><input type="text" id="withdraw-account" placeholder="የባንክ ሂሳብ ቁጥር ወይም የቴሌብር ስልክ" required></div><div class="form-group"><label for="withdraw-name"><i class="fas fa-user-tag"></i> የስምዎ ማረጋገጫ:</label><input type="text" id="withdraw-name" placeholder="በባንክ አካውንት ላይ ያለዎትን ስም ያስገቡ" required></div><div class="form-group"><label for="withdraw-amount"><i class="fas fa-money-bill-wave"></i> የገንዘብ መጠን (ETB):</label><input type="number" id="withdraw-amount" required min="10"></div><button type="submit" class="submit-button btn-withdraw">ጥያቄ ላክ</button></form><button onclick="window.location.hash = '#account-page'" class="submit-button" style="background-color: #aaa; margin-top: 10px;">ተመለስ</button><div id="alert-message-box" style="margin-top: 10px;"></div></div>`;
    document.getElementById('withdraw-form').addEventListener('submit', handleWithdraw);
}


// ----------------------------------------------------
// 7. የይለፍ ቃል መቀየሪያ ሎጂክ
// ----------------------------------------------------

function renderChangePasswordPage() {
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
    e.preventDefault();
    
    const oldPassword = document.getElementById('old-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmNewPassword = document.getElementById('confirm-new-password').value;

    if (oldPassword !== currentUser.password) { alertUser("አሁን ያስገቡት የይለፍ ቃል ትክክል አይደለም!", 'error'); return; }
    if (newPassword.length < 5) { alertUser("አዲሱ የይለፍ ቃል ቢያንስ 5 ፊደላት/ቁጥሮች መያዝ አለበት።", 'error'); return; }
    if (newPassword !== confirmNewPassword) { alertUser("አዲሱ የይለፍ ቃል እና የማረጋገጫው ቃል አይመሳሰለሉም!", 'error'); return; }
    if (newPassword === oldPassword) { alertUser("አዲስ የይለፍ ቃልዎ ከድሮው የይለፍ ቃልዎ ጋር መመሳሰል የለበትም!", 'error'); return; }
    
    try {
        // የይለፍ ቃሉን በ Firestore ላይ ማዘመን
        await db.collection('users').doc(currentUser.id).update({
            password: newPassword
        });
        
        currentUser.password = newPassword; // Local object update
        alertUser("የይለፍ ቃልዎ በተሳካ ሁኔታ ተቀይሯል።", 'success');
        window.location.hash = '#account-page';

    } catch (e) {
        console.error("Error changing password:", e);
        alertUser('የይለፍ ቃልዎን በመቀየር ላይ ስህተት ተፈጥሯል።', 'error');
    }
}


// ----------------------------------------------------
// 8. የገጽ አሳሾች (Page Renderers)
// ----------------------------------------------------

function renderUserListPage() {
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
    if (!isLoggedIn || !currentUser) { window.location.hash = '#login-page'; return; }
    
    // የቅርብ ጊዜውን የተጠቃሚ መረጃ ማግኘት
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
    isLoggedIn = false;
    isAdmin = false;
    currentUser = null;
    currentBalance = 0.00; 
    
    // ክፍለ ጊዜውን ከ Local Storage ማስወገድ
    localStorage.removeItem('currentUserPhone');
    
    if (showAlert) {
         alertUser('ከመለያዎ ወጥተዋል::', 'info');
    }
    renderActivePage();
    window.location.hash = '#login-page';
}

// ----------------------------------------------------
// 9. Utility Functions (Custom Alert & Confirm)
// ----------------------------------------------------

// Custom Alert Box (Replacing alert())
function alertUser(message, type = 'info') {
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

// Custom Confirm Box (Replacing confirm())
function customConfirm(message) {
    return new Promise(resolve => {
        const box = document.getElementById('alert-message-box');
        if (!box) {
             // Fallback for missing box
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


// ----------------------------------------------------
// 10. ጅምር (Initialization)
// ----------------------------------------------------

function initializeApp() {
    // 1. የክፍለ ጊዜ ማረጋገጫ (Session Check)
    const savedPhone = localStorage.getItem('currentUserPhone');
    if (savedPhone) {
        // መጀመሪያ ላይ ተጠቃሚው Local Storage ላይ ቢኖርም isLoggedIn = false ነው
        currentUser = allUsers.find(u => u.phone === savedPhone);
        if (currentUser) {
            isLoggedIn = true;
            isAdmin = (currentUser.phone === adminTelebirrPhone);
        } else {
             localStorage.removeItem('currentUserPhone');
        }
    }
    
    // 2. Real-time Listenersን ማስጀመር (ይህ ዳታውን ከ Firestore ላይ ይጭናል)
    listenToUsers(); 
    listenToRecharges(); 
    listenToWithdrawals(); 

    // 3. የገጽ ለውጦችን መከታተል
    window.addEventListener('hashchange', renderActivePage);

    // ገጹን ለመጀመሪያ ጊዜ መጫን
    renderActivePage(); 
}

// ኮዱ ከወረደ በኋላ ያስጀምራል
window.addEventListener('load', initializeApp);
