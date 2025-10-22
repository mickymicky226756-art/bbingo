// =================================================================
// ETHIO BINGO - FRONT-END JAVASCRIPT LOGIC (script.js)
// የመጨረሻ ማስተካከያዎች:
// ** ትልቅ ለውጥ: ሁሉም ዳታዎች (Registered Users, Recharge/Withdrawal) በአድሚኑ ቁጥር ስር
//    Local Storage ውስጥ እንዲቀመጡ ተደርጓል::
// ** አዲስ ለውጥ: አድሚን በሌላ ስልክ የተላከ ዳታ ወዲያውኑ ለማየት የሚያስችል 'ዳታ አድስ' (Force Refresh)
//    አዝራር በአድሚን ገጽ ላይ ተጨምሯል::
// =================================================================

// 1. ግሎባል ተለዋዋጮች (Global Variables)
let isLoggedIn = false; 
let currentBalance = 0.00; 
let currentUser = null; 
// እነዚህ ተለዋዋጮች የሚሞሉት ከ Local Storage ላይ ነው
let pendingRecharges = []; 
let pendingWithdrawals = []; 
let isAdmin = false; 
const appContainer = document.getElementById('app-container');
const navContainer = document.getElementById('main-nav'); 
const adminTelebirrPhone = '0922675655'; // የአድሚኑ ቋሚ ቁጥር
const adminTelebirrName = 'ሚኪያስ'; 

// የተመዘገቡ ተጠቃሚዎችን መረጃ ለማስቀመጥ
const registeredUsers = []; 

// የአድሚን መለያውን በቅድሚያ ወደ ዝርዝሩ ማስገባት
const defaultAdmin = { phone: adminTelebirrPhone, password: 'adminpass', name: adminTelebirrName, balance: 1000.00, referralCode: 'ET95655123' };


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
        alert('ኮዱን መገልበጥ አልተቻለም። በእጅዎ ይቅዱት: ' + code);
    });
}

// ----------------------------------------------------
// 2. የዳታ ማስተዳደሪያ ፋንክሽኖች (Data Persistence) 
// ----------------------------------------------------

// 🔑 ቁልፍ: ሁለቱንም የተጠቃሚዎች እና የግብይት ቁልፎችን ከአድሚኑ ቁጥር ጋር ማያያዝ
function getGlobalStorageKey(key) {
    // ይህ ቁልፍ ሁልጊዜ በሁሉም ብሮውዘሮች ላይ ተመሳሳይ ስለሆነ እንደ ማእከላዊ ዳታቤዝ ያገለግላል
    return `${key}_${adminTelebirrPhone}`;
}

function saveAllData() {
    // 1. የተጠቃሚዎችን መረጃ በ GLOBAL ቁልፍ ማስቀመጥ
    localStorage.setItem(getGlobalStorageKey('registeredUsers'), JSON.stringify(registeredUsers));
    
    // 2. የግብይት ጥያቄዎችን በ GLOBAL ቁልፍ ማስቀመጥ
    localStorage.setItem(getGlobalStorageKey('pendingRecharges'), JSON.stringify(pendingRecharges));
    localStorage.setItem(getGlobalStorageKey('pendingWithdrawals'), JSON.stringify(pendingWithdrawals));
    
    // 3. የአሁን ተጠቃሚው ክፍለጊዜ ማስቀመጥ (local to browser)
    if (currentUser) {
        localStorage.setItem('currentUserPhone', currentUser.phone); 
    } else {
        localStorage.removeItem('currentUserPhone');
    }
}

function loadAllData() {
    // 1. የተጠቃሚዎችን መረጃ ከ GLOBAL ቁልፍ መጫን
    const savedUsersGlobal = localStorage.getItem(getGlobalStorageKey('registeredUsers'));
    
    if (savedUsersGlobal) {
        const loadedUsers = JSON.parse(savedUsersGlobal);
        // ነባሩን ዝርዝር በማፅዳት በአዲሱ መተካት
        registeredUsers.splice(0, registeredUsers.length, ...loadedUsers);
    } else {
         registeredUsers.splice(0, registeredUsers.length); 
    }
    
    // የአድሚን መለያ ከሌለ ማስገባት
    const adminExists = registeredUsers.some(u => u.phone === defaultAdmin.phone);
    if (!adminExists) {
         registeredUsers.push(defaultAdmin);
    }
    
    // 2. የግብይት መረጃዎችን ከ GLOBAL ቁልፍ መጫን
    const savedRechargesGlobal = localStorage.getItem(getGlobalStorageKey('pendingRecharges'));
    const savedWithdrawalsGlobal = localStorage.getItem(getGlobalStorageKey('pendingWithdrawals'));
    
    if (savedRechargesGlobal) {
        pendingRecharges.splice(0, pendingRecharges.length, ...JSON.parse(savedRechargesGlobal));
    } else {
        pendingRecharges.splice(0, pendingRecharges.length);
    }
    
    if (savedWithdrawalsGlobal) {
        pendingWithdrawals.splice(0, pendingWithdrawals.length, ...JSON.parse(savedWithdrawalsGlobal));
    } else {
         pendingWithdrawals.splice(0, pendingWithdrawals.length);
    }
    
    // 3. የተጠቃሚው ክፍለጊዜ (Session) ካለ መጫን
    const savedCurrentUserPhone = localStorage.getItem('currentUserPhone');
    
    if (savedCurrentUserPhone) {
        // ሁልጊዜ ከተጫነው GLOBAL ዝርዝር ላይ መፈለግ
        currentUser = registeredUsers.find(user => user.phone === savedCurrentUserPhone);
        if (currentUser) {
            isLoggedIn = true;
            currentBalance = currentUser.balance;
            isAdmin = (currentUser.phone === adminTelebirrPhone);
        } else {
            handleLogout(false);
        }
    }
}

// ----------------------------------------------------
// 3. የገጽ አሰሳ እና ጅምር (Navigation and Initialization)
// ----------------------------------------------------

// 🔑 አዲስ ፋንክሽን: አድሚኑ ዳታውን በግዳጅ እንዲያድስ
function forceDataRefresh() {
    loadAllData();
    renderAccountPage();
    alert('ዳታው ከአዲሱ መረጃ ጋር ተዘምኗል።');
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
            </a>
        `;
    }
    
    // የ Navbar CSS Style
    navContainer.style.cssText = `
        display: flex; 
        justify-content: space-around; 
        align-items: center;
        background-color: #333; 
        padding: 5px 0; 
        position: sticky; 
        top: 0; 
        z-index: 1000;
        border-bottom: 2px solid #004a99;
    `;
    navContainer.innerHTML = navHtml;

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
        } else if (link.tagName === 'A') {
            link.style.backgroundColor = 'transparent';
        } else if (link.classList.contains('nav-logout-btn')) {
             link.style.cssText += `
                background: none; 
                border: none; 
                color: #fff; 
                cursor: pointer; 
                font-size: 1em;
             `;
        }

        link.onmouseover = function() { this.style.backgroundColor = '#555'; };
        link.onmouseout = function() { 
            if (link.tagName === 'A' && this.classList.contains('active')) {
                this.style.backgroundColor = '#004a99';
            } else if (link.classList.contains('nav-logout-btn')) {
                 this.style.backgroundColor = 'transparent';
            } else {
                this.style.backgroundColor = 'transparent';
            }
        };
    });
}

function renderRegisterPage() {
    appContainer.innerHTML = `<div class="page-container"><h2>አዲስ መለያ ይክፈቱ</h2><form id="register-form"><div class="form-group"><label for="reg-name"><i class="fas fa-user"></i> ስምዎን ያስገቡ:</label><input type="text" id="reg-name" name="name" placeholder="ሙሉ ስምዎን ያስገቡ" required></div><div class="form-group"><label for="reg-phone"><i class="fas fa-phone"></i> ስልክ ቁጥር:</label><input type="tel" id="reg-phone" name="phone" placeholder="ለምሳሌ: 09..." required></div><div class="form-group"><label for="reg-password"><i class="fas fa-lock"></i> የይለፍ ቃል:</label><input type="password" id="reg-password" name="password" required></div><div class="form-group"><label for="reg-confirm-password"><i class="fas fa-check-lock"></i> የይለፍ ቃል አረጋግጥ:</label><input type="password" id="reg-confirm-password" name="confirm_password" required></div><div class="form-group"><label for="reg-invite"><i class="fas fa-user-plus"></i> የመጋበዣ ኮድ (አማራጭ):</label><input type="text" id="reg-invite" name="invite_code" placeholder="ጋባዥ ካለ ኮዱን ያስገቡ"></div><button type="submit" class="submit-button">መዝግብ</button><p style="margin-top: 15px;">መለያ አለዎት? <a href="#login-page">ይግቡ</a></p></form></div>`;
    document.getElementById('register-form').addEventListener('submit', handleRegistration);
}
function handleRegistration(e) {
    e.preventDefault();
    loadAllData(); // ከመመዝገብ በፊት ያሉትን ተጠቃሚዎች መጫን (ሁልጊዜ GLOBAL ዝርዝሩን)
    
    const name = document.getElementById('reg-name').value.trim(); 
    const phone = document.getElementById('reg-phone').value;
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value; 
    const inviteCode = document.getElementById('reg-invite').value.trim().toUpperCase(); 
    if (password !== confirmPassword) { alert('የይለፍ ቃሉ እና የማረጋገጫ ይለፍ ቃሉ አይመሳሰለሉም! እባክዎ በትክክል ያስገቡ።'); return; }
    if (name.length < 2) { alert('እባክዎ ትክክለኛ ስምዎን ያስገቡ።'); return; }
    
    // የተጫነውን GLOBAL ዝርዝር በመጠቀም ማረጋገጥ
    if (registeredUsers.some(user => user.phone === phone)) { alert(`ይህ ስልክ ቁጥር (${phone}) አስቀድሞ ተመዝግቧል። ወደ መግቢያ ገጽ ይሂዱ።`); return; }
    
    const newReferralCode = generateReferralCode(phone);
    
    const newUser = { phone: phone, password: password, name: name, balance: 0.00, referralCode: newReferralCode };
    registeredUsers.push(newUser); // ወደ GLOBAL ዝርዝር መጨመር
    
    let rewardMessage = '';
    if (inviteCode) {
        const referrer = registeredUsers.find(user => user.referralCode === inviteCode);
        if (referrer && referrer.phone !== phone) {
            const rewardAmount = 10.00;
            referrer.balance += rewardAmount; 
            // ጋባዡ የለውጥ መረጃ እንዲገባበት ማድረግ
            const referrerIndex = registeredUsers.findIndex(u => u.phone === referrer.phone);
            if (referrerIndex !== -1) {
                 registeredUsers[referrerIndex] = referrer;
            }
            rewardMessage = `እና ጋባዥዎ (${referrer.name}) በ ${rewardAmount.toFixed(2)} ETB ሽልማት አግኝተዋል።`;
        } else if (referrer && referrer.phone === phone) { alert("የራስዎን ስልክ ቁጥር ወይም ኮድ መጠቀም አይችሉም!"); } 
        else { alert("ያስገቡት የመጋበዣ ኮድ ትክክል አይደለም።"); }
    }
    
    saveAllData(); // GLOBAL ዝርዝሩን ማስቀመጥ (ለአድሚኑ እንዲደርሰው)
    
    alert(`በተሳካ ሁኔታ ተመዝግበዋል! አሁን መግባት ይችላሉ። ${rewardMessage}`);
    window.location.hash = '#login-page'; 
}
function renderLoginPage() {
    appContainer.innerHTML = `<div class="page-container"><h2>ወደ መለያዎ ይግቡ</h2><form id="login-form"><div class="form-group"><label for="log-phone"><i class="fas fa-phone"></i> ስልክ ቁጥር:</label><input type="tel" id="log-phone" name="phone" required></div><div class="form-group"><label for="log-password"><i class="fas fa-lock"></i> የይለፍ ቃል:</label><input type="password" id="log-password" name="password" required></div><button type="submit" class="submit-button">ግባ</button></form><p style="margin-top: 15px;">አዲስ ነዎት? <a href="#register-page">ይመዝገቡ</a></p></div>`;
    document.getElementById('login-form').addEventListener('submit', handleLogin);
}

function handleLogin(e) {
    e.preventDefault();
    loadAllData(); // ከመግባት በፊት ያሉትን ተጠቃሚዎች መጫን (GLOBAL ዝርዝሩን)
    
    const phone = document.getElementById('log-phone').value;
    const password = document.getElementById('log-password').value;
    
    // የተጫነውን GLOBAL ዝርዝር በመጠቀም መፈለግ
    const userFound = registeredUsers.find(user => user.phone === phone && user.password === password);
    
    if (userFound) {
        currentUser = userFound;
        currentBalance = currentUser.balance; 
        isAdmin = (phone === adminTelebirrPhone);
        
        isLoggedIn = true;
        
        saveAllData(); // አሁን የተገባበትን userPhone በ Local Storage ማስቀመጥ
        
        alert(isAdmin ? 'በአድሚንነት ገብተዋል!' : 'በተጠቃሚነት ገብተዋል!');
        renderNavbar(); 
        window.location.hash = '#account-page';
    } else {
        alert('ስልክ ቁጥር ወይም የይለፍ ቃል ትክክል አይደለም። ወይም አልተመዘገቡም።');
        isLoggedIn = false;
        isAdmin = false;
        currentUser = null;
        saveAllData(); 
    }
}

function renderWithdrawFormPage() {
    if (!isLoggedIn || !currentUser) { window.location.hash = '#login-page'; return; }
    appContainer.innerHTML = `<div class="page-container"><h2><i class="fas fa-minus-circle"></i> ገንዘብ አውጣ (Withdraw)</h2><div class="account-info" style="margin-bottom: 20px;"><p>አሁን ያለዎት ቀሪ ሂሳብ: **ETB ${currentUser.balance.toFixed(2)}**</p></div><form id="withdraw-form" style="margin-top: 20px;"><div class="form-group"><label for="withdraw-bank"><i class="fas fa-university"></i> ገንዘብ የሚላክበት ባንክ:</label><select id="withdraw-bank" name="bank" required><option value="">-- ባንክ ይምረጡ --</option><option value="CBE">ንግድ ባንክ (CBE)</option><option value="Abyssinia">አቢሲኒያ ባንክ</option><option value="Dashen">ዳሽን ባንክ</option><option value="Telebirr">ቴሌብር</option><option value="Awash">አዋሽ ባንክ</option></select></div><div class="form-group"><label for="withdraw-account"><i class="fas fa-wallet"></i> የባንክ ሂሳብ/ስልክ ቁጥር:</label><input type="text" id="withdraw-account" placeholder="የባንክ ሂሳብ ቁጥር ወይም የቴሌብር ስልክ" required></div><div class="form-group"><label for="withdraw-name"><i class="fas fa-user-tag"></i> የስምዎ ማረጋገጫ:</label><input type="text" id="withdraw-name" placeholder="በባንክ አካውንት ላይ ያለዎትን ስም ያስገቡ" required></div><div class="form-group"><label for="withdraw-amount"><i class="fas fa-money-bill-wave"></i> የገንዘብ መጠን (ETB):</label><input type="number" id="withdraw-amount" required min="10"></div><button type="submit" class="submit-button btn-withdraw">ጥያቄ ላክ</button></form><button onclick="window.location.hash = '#account-page'" class="submit-button" style="background-color: #aaa; margin-top: 10px;">ተመለስ</button></div>`;
    document.getElementById('withdraw-form').addEventListener('submit', handleWithdraw);
}
function renderRechargeFormPage() {
    if (!isLoggedIn) { window.location.hash = '#login-page'; return; }
    appContainer.innerHTML = `<div class="page-container"><h2><i class="fas fa-plus-circle"></i> ገንዘብ አስገባ (Recharge)</h2><div class="account-info" style="text-align: center;"><p style="font-size: 1.1em; font-weight: bold; color: #cc0000;">**መጀመሪያ ገንዘቡን ይላኩ!**</p><p>ገንዘቡን ወደሚከተለው የቴሌብር ቁጥር ይላኩ፡</p><p style="font-size: 1.4em; color: #004a99; font-weight: bold;"><i class="fas fa-mobile-alt"></i> ${adminTelebirrPhone} (${adminTelebirrName})</p><p style="margin-top: 15px; font-weight: bold;">ገንዘቡን ከላኩ በኋላ የሚከተለውን ቅፅ ይሙሉ።</p></div><form id="recharge-form" style="margin-top: 20px;"><div class="form-group"><label for="recharge-amount"><i class="fas fa-money-bill-wave"></i> የገንዘብ መጠን (ETB):</label><input type="number" id="recharge-amount" required min="10"></div><div class="form-group"><label for="transaction-id"><i class="fas fa-key"></i> የግብይት መለያ ቁጥር (Transaction ID):</label><input type="text" id="transaction-id" placeholder="ገንዘብ ከላኩ በኋላ የሚደርስዎትን ID ያስገቡ" required></div><button type="submit" class="submit-button btn-recharge">ጥያቄ ላክ</button></form><button onclick="window.location.hash = '#account-page'" class="submit-button" style="background-color: #aaa; margin-top: 10px;">ተመለስ</button></div>`;
    document.getElementById('recharge-form').addEventListener('submit', handleRechargeRequest);
}
function handleRechargeRequest(e) {
    e.preventDefault();
    loadAllData(); // የቅርብ ጊዜዎቹን ጥያቄዎች እና የተጠቃሚዎች ዝርዝር ጫን
    
    const amount = document.getElementById('recharge-amount').value;
    const transactionId = document.getElementById('transaction-id').value;
    const numAmount = parseFloat(amount);
    if (numAmount < 10) { alert("ቢያንስ 10 ETB ማስገባት አለብዎት።"); return; }
    if (transactionId.length < 5) { alert("እባክዎ ትክክለኛ የግብይት መለያ ቁጥር (Transaction ID) ያስገቡ።"); return; }
    
    // የጥያቄው መረጃ
    const request = { id: Date.now(), userPhone: currentUser.phone, amount: numAmount, transactionId: transactionId, date: new Date().toLocaleString('am-ET'), status: 'Pending' };
    
    // ጥያቄውን መጨመር
    pendingRecharges.push(request); 
    
    // በ GLOBAL ቁልፍ ስም ማስቀመጥ (ሁሉም ብሮውዘር እንዲያየው)
    saveAllData(); 
    
    alert(`የ ETB ${numAmount.toFixed(2)} ማስገቢያ ጥያቄዎ በተሳካ ሁኔታ ተልኳል።`);
    window.location.hash = '#account-page';
}
function confirmRecharge(requestId, amount, userPhone) {
    if (!isAdmin) { alert("ይህንን ተግባር ማከናወን የሚችሉት አድሚኖች ብቻ ናቸው!"); return; }
    if (!confirm(`ይህንን የ ${amount.toFixed(2)} ETB ገቢ በእርግጥ ለተጠቃሚ ${userPhone} ማረጋገጥ ይፈልጋሉ?`)) { return; }
    
    loadAllData(); // የቅርብ ጊዜውን GLOBAL ዳታ መጫን
    
    // ተጠቃሚውን ከ GLOBAL ዝርዝር ላይ ፈልጎ ማግኘት
    const targetUser = registeredUsers.find(user => user.phone === userPhone);
    
    if (targetUser) {
        targetUser.balance += amount; 
        
        // በዝርዝሩ ላይ ያለውንም መረጃ ማዘመን
        const userIndex = registeredUsers.findIndex(u => u.phone === userPhone);
        if (userIndex !== -1) {
             registeredUsers[userIndex] = targetUser;
        }
        
        // አሁን ያለውን ተጠቃሚ (አድሚኑ ራሱ) ቀሪ ሂሳብ ማዘመን (ቢያስፈልግ)
        if (currentUser && currentUser.phone === userPhone) { currentUser.balance = targetUser.balance; }
        
        alert(`ETB ${amount.toFixed(2)} በተሳካ ሁኔታ ወደ ተጠቃሚ ${userPhone} ሂሳብ ገብቷል።`);
    } else { alert(`ስልክ ቁጥር ${userPhone} ያለው ተጠቃሚ አልተገኘም!`); }
    
    // የተረጋገጠውን ጥያቄ ከዝርዝሩ ማስወገድ
    pendingRecharges = pendingRecharges.filter(req => req.id !== requestId);
    
    saveAllData(); // GLOBAL ዝርዝሩን ማስቀመጥ
    
    renderAccountPage();
}
function handleWithdraw(e) {
    e.preventDefault();
    loadAllData(); // የቅርብ ጊዜዎቹን ጥያቄዎች እና የተጠቃሚዎች ዝርዝር ጫን
    
    const bank = document.getElementById('withdraw-bank').value;
    const account = document.getElementById('withdraw-account').value;
    const name = document.getElementById('withdraw-name').value;
    const amount = document.getElementById('withdraw-amount').value;
    const numAmount = parseFloat(amount);
    
    if (numAmount < 10) { alert("ቢያንስ 10 ETB ማውጣት አለብዎት።"); return; }
    
    // የቅርብ ጊዜው ቀሪ ሂሳብ ላይ መሞከር
    const updatedUser = registeredUsers.find(u => u.phone === currentUser.phone);
    if (!updatedUser || numAmount > updatedUser.balance) { 
        alert("በመለያዎ ውስጥ በቂ ገንዘብ የለም! ቀሪ ሂሳብ: ETB " + (updatedUser ? updatedUser.balance.toFixed(2) : currentBalance.toFixed(2))); 
        return; 
    }
    
    // ገንዘቡን መቀነስ
    updatedUser.balance -= numAmount; 
    currentUser.balance = updatedUser.balance;
    currentBalance = currentUser.balance; 
    
    // በ GLOBAL ዝርዝር ላይ ያለውንም መረጃ ማዘመን
    const userIndex = registeredUsers.findIndex(u => u.phone === currentUser.phone);
    if (userIndex !== -1) {
        registeredUsers[userIndex].balance = currentBalance;
    }
    
    // የማውጫ ጥያቄውን መጨመር
    const request = { id: Date.now(), userPhone: currentUser.phone, userName: currentUser.name, amount: numAmount, bank: bank, account: account, accountName: name, date: new Date().toLocaleString('am-ET'), status: 'Pending' };
    pendingWithdrawals.push(request); 
    
    // በ GLOBAL ቁልፍ ስም ማስቀመጥ (ሁሉም ብሮውዘር እንዲያየው)
    saveAllData(); 
    
    alert(`የ ETB ${numAmount.toFixed(2)} የማውጫ ጥያቄዎ በተሳካ ሁኔታ ተልኳል።`);
    window.location.hash = '#account-page';
}
function confirmWithdrawal(requestId) {
    if (!isAdmin) { alert("ይህንን ተግባር ማከናወን የሚችሉት አድሚኖች ብቻ ናቸው!"); return; }
    
    loadAllData(); // የቅርብ ጊዜውን GLOBAL ዳታ መጫን
    
    const request = pendingWithdrawals.find(req => req.id === requestId);
    if (!request) { alert("ይህ የማውጫ ጥያቄ አልተገኘም!"); return; }
    if (!confirm(`ገንዘቡን ለተጠቃሚው ${request.userPhone} ወደ ${request.bank} አካውንት ${request.account} አስተላልፈዋል?`)) { return; }
    
    // የተረጋገጠውን ጥያቄ ከዝርዝሩ ማስወገድ
    pendingWithdrawals = pendingWithdrawals.filter(req => req.id !== requestId);
    
    saveAllData(); // GLOBAL ዝርዝሩን ማስቀመጥ
    
    renderAccountPage();
}

// ----------------------------------------------------
// የይለፍ ቃል መቀየሪያ ሎጂክ
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
        </div>
    `;
    document.getElementById('change-password-form').addEventListener('submit', handleChangePassword);
}

function handleChangePassword(e) {
    e.preventDefault();
    
    const oldPassword = document.getElementById('old-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmNewPassword = document.getElementById('confirm-new-password').value;

    // 1. የድሮ የይለፍ ቃል ማረጋገጥ
    if (oldPassword !== currentUser.password) {
        alert("አሁን ያስገቡት የይለፍ ቃል ትክክል አይደለም!");
        return;
    }

    // 2. አዲሱ የይለፍ ቃል ማረጋገጥ
    if (newPassword.length < 5) {
        alert("አዲሱ የይለፍ ቃል ቢያንስ 5 ፊደላት/ቁጥሮች መያዝ አለበት።");
        return;
    }
    
    if (newPassword !== confirmNewPassword) {
        alert("አዲሱ የይለፍ ቃል እና የማረጋገጫው ቃል አይመሳሰለሉም!");
        return;
    }
    
    if (newPassword === oldPassword) {
        alert("አዲስ የይለፍ ቃልዎ ከድሮው የይለፍ ቃልዎ ጋር መመሳሰል የለበትም!");
        return;
    }

    // 3. የይለፍ ቃሉን በcurrentUser ላይ ማዘመን
    currentUser.password = newPassword;

    // 4. በ GLOBAL ዝርዝር ውስጥ ማዘመን እና ዳታውን ማስቀመጥ
    const userIndex = registeredUsers.findIndex(u => u.phone === currentUser.phone);
    if (userIndex !== -1) {
        registeredUsers[userIndex].password = newPassword;
    }
    
    saveAllData(); // GLOBAL ዝርዝሩን ማስቀመጥ

    alert("የይለፍ ቃልዎ በተሳካ ሁኔታ ተቀይሯል።");
    window.location.hash = '#account-page';
}

// ----------------------------------------------------
// 4. የገጽ አሳሾች (Page Renderers)
// ----------------------------------------------------

// አዲስ የተመዘገቡ ተጠቃሚዎችን ዝርዝር የሚያሳይ ገጽ
function renderUserListPage() {
     if (!isAdmin) { 
        alert('ይህንን ገጽ ማየት የሚችሉት አድሚኖች ብቻ ናቸው!'); 
        window.location.hash = '#account-page'; 
        return; 
    }
    
    loadAllData(); // የቅርብ ጊዜውን GLOBAL ዝርዝር መጫን
    
    const usersHtml = registeredUsers.filter(u => u.phone !== adminTelebirrPhone).map(user => `
        <li style="border: 1px solid #ccc; padding: 10px; margin-bottom: 8px; border-radius: 4px; background-color: #f9f9f9;">
            <strong>ስም:</strong> ${user.name}<br>
            <strong>ስልክ ቁጥር:</strong> ${user.phone}<br>
            <strong>ቀሪ ሂሳብ:</strong> ETB ${user.balance.toFixed(2)}<br>
            <strong>ኮድ:</strong> ${user.referralCode}
        </li>
    `).join('');
    
    appContainer.innerHTML = `
        <div class="page-container">
            <h2><i class="fas fa-users"></i> የተመዘገቡ ተጠቃሚዎች ዝርዝር</h2>
            <p>ጠቅላላ ተጠቃሚዎች (ከአድሚን ውጪ): ${registeredUsers.length - 1}</p>
            <ul style="list-style-type: none; padding: 0; text-align: left; margin-top: 15px;">
                ${usersHtml.length > 0 ? usersHtml : '<p>የተመዘገቡ ተጠቃሚዎች የሉም።</p>'}
            </ul>
            <button onclick="window.location.hash = '#account-page'" class="submit-button" style="background-color: #aaa; margin-top: 20px;">ተመለስ</button>
            <button class="submit-button" style="background-color: #f7b731; color: #333; margin-top: 10px; border: none;" onclick="forceDataRefresh()">
                <i class="fas fa-sync-alt"></i> ዳታ አድስ (Force Refresh)
            </button>
        </div>
    `;
}

function renderAccountPage() {
    if (!isLoggedIn || !currentUser) { alert('መጀመሪያ ይግቡ!'); window.location.hash = '#login-page'; return; }
    
    // ገጹ ሲከፈት የቅርብ ጊዜውን ዳታ መጫን
    loadAllData(); 
    
    // የቅርብ ጊዜውን ቀሪ ሂሳብ ከመዝገብ ላይ ማግኘት
    const updatedUser = registeredUsers.find(u => u.phone === currentUser.phone);
    if (updatedUser) {
        currentUser.balance = updatedUser.balance;
        currentBalance = updatedUser.balance;
    }

    function getConfirmButton(reqId, reqAmount, reqPhone, type) {
        if (isAdmin) {
            if (type === 'recharge') {
                 return `<button onclick="confirmRecharge(${reqId}, ${reqAmount}, '${reqPhone}')" style="flex-basis: 25%; padding: 5px; background-color: #38761d; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 5px;">ገቢ አረጋግጥ</button>`;
            } else if (type === 'withdraw') {
                 return `<button onclick="confirmWithdrawal(${reqId})" style="flex-basis: 25%; padding: 5px; background-color: #004a99; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 5px;">ክፍያ አረጋግጥ</button>`;
            }
        }
        return '<span style="color: red; font-weight: bold; margin-top: 5px; display: block;">በመጠባበቅ ላይ...</span>';
    }
    
    // አድሚን ከሆነ ሁሉንም ጥያቄ ያያል፣ ካልሆነ የራሱን ብቻ
    const userRecharges = pendingRecharges.filter(req => isAdmin || req.userPhone === currentUser.phone);
    const userWithdrawals = pendingWithdrawals.filter(req => isAdmin || req.userPhone === currentUser.phone);
    
    const pendingRechargeHtml = userRecharges.length > 0 ? `<h3 style="margin-top: 20px; color: #cc0000;"><i class="fas fa-clock"></i> በመጠባበቅ ላይ ያሉ ገቢዎች (${userRecharges.length}):</h3><ul style="list-style-type: none; padding: 0;">${userRecharges.map(req => {
        return `<li style="border: 1px dashed #ffcc00; padding: 10px; margin-bottom: 5px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;"><div style="flex-basis: ${isAdmin ? '70%' : '100%'}; text-align: left;"><strong>+${req.amount.toFixed(2)} ETB</strong> - ID: <span style="font-weight: bold; color: #004a99;">${req.transactionId}</span>${isAdmin ? `<br><span style="font-size: 0.9em; color: #008080;">ለ: ${req.userPhone}</span>` : ''}<br><span style="font-size: 0.8em; color: #888;">ጥያቄ የላኩበት: ${req.date}</span></div>${getConfirmButton(req.id, req.amount, req.userPhone, 'recharge')}</li>`; }).join('')}</ul>` : '';
    
    const pendingWithdrawalHtml = userWithdrawals.length > 0 ? `<h3 style="margin-top: 20px; color: #9933cc;"><i class="fas fa-hourglass-half"></i> በመጠባበቅ ላይ ያሉ ገንዘብ ማውጫዎች (${userWithdrawals.length}):</h3><ul style="list-style-type: none; padding: 0;">${userWithdrawals.map(req => {
        return `<li style="border: 1px dashed #9933cc; padding: 10px; margin-bottom: 5px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;"><div style="flex-basis: ${isAdmin ? '70%' : '100%'}; text-align: left;"><strong>-ETB ${req.amount.toFixed(2)}</strong> (${req.bank})<br>${isAdmin ? `<span style="font-size: 0.9em; color: #008080;">ለ: ${req.accountName} (${req.account})</span><br>` : ''}<span style="font-size: 0.8em; color: #888;">ጥያቄ የላኩበት: ${req.date}</span></div>${getConfirmButton(req.id, req.amount, req.userPhone, 'withdraw')}</li>`; }).join('')}</ul>` : '';
    
    const adminUserListButton = isAdmin ? 
        `<button class="submit-button" style="background-color: #38761d; color: white; margin-top: 10px;" onclick="window.location.hash = '#user-list-page'">
            <i class="fas fa-users"></i> የተመዘገቡ ተጠቃሚዎችን ዝርዝር እይ
        </button>` : '';
        
    const adminRefreshButton = isAdmin ? 
        `<button class="submit-button" style="background-color: #f7b731; color: #333; margin-top: 10px; border: none; font-weight: bold;" onclick="forceDataRefresh()">
            <i class="fas fa-sync-alt"></i> ዳታ አድስ (Force Refresh)
        </button>
        <p style="font-size: 0.8em; color: #cc0000; margin-top: 5px;">**አዲስ ጥያቄ ሲደርስዎ ይህንን ይጠቀሙ**</p>` : '';
        
    appContainer.innerHTML = `
        <div class="page-container">
            <h2><i class="fas fa-user-circle"></i> የኔ መለያ ${isAdmin ? ' (Admin)' : ''}</h2>
            <div class="account-info">
                <h3>የግል መለያ መረጃ:</h3>
                <p><strong>ስልክ ቁጥር:</strong> ${currentUser.phone}</p>
                <p><strong>መታወቂያ (ID):</strong> ETB12345</p>
                <p><strong>የተመዘገበበት ስም:</strong> ${currentUser.name}</p>
                <p class="referral-code-info">
                    <strong>የእርስዎ መጋበዣ ኮድ:</strong> 
                    <span id="my-referral-code" style="font-weight: bold; color: #004a99; cursor: pointer;" onclick="copyReferralCode('${currentUser.referralCode}')">${currentUser.referralCode || 'አልተሰጠም'} <i class="fas fa-copy"></i></span>
                </p>
                <p id="copy-message" style="color: green; font-size: 0.9em; margin-top: 5px; display: none;">ኮዱ ተቀድቷል!</p>
                <h3 style="margin-top: 15px;">የቀሪ ሂሳብዎ:</h3>
                <p class="balance">ETB ${currentBalance.toFixed(2)}</p>
                <div class="btn-group">
                    <button class="btn-recharge" onclick="window.location.hash = '#recharge-form-page'"><i class="fas fa-plus-circle"></i> ገንዘብ አስገባ</button>
                    <button class="btn-withdraw" onclick="window.location.hash = '#withdraw-form-page'"><i class="fas fa-minus-circle"></i> ገንዘብ አውጣ</button>
                </div>
            </div>
            
            ${adminUserListButton} 
            ${adminRefreshButton}
            
            <div class="transaction-section">
                <h3><i class="fas fa-history"></i> የግብይት ታሪክ (ናሙና):</h3>
                <ul>
                    <li>-ETB 10.00 - ውርርድ (ናሙና)</li>
                    <li>+ETB 5.00 - ኮሚሽን (ናሙና)</li>
                </ul>
                ${pendingRechargeHtml}
                ${pendingWithdrawalHtml}
            </div>
            
            <button class="submit-button" style="background-color: #cc0000; color: white; margin-top: 20px;" onclick="handleLogout()">
                <i class="fas fa-sign-out-alt"></i> ውጣ
            </button>
            
            <button class="submit-button" style="background-color: #555; color: white; margin-top: 10px;" onclick="window.location.hash = '#change-password-page'">
                <i class="fas fa-key"></i> የይለፍ ቃል ቀይር
            </button>

        </div>`;
}

function handleLogout(showAlert = true) {
    isLoggedIn = false;
    isAdmin = false;
    currentUser = null;
    currentBalance = 0.00; 
    
    saveAllData(); 
    if (showAlert) {
         alert('ከመለያዎ ወጥተዋል::');
    }
    renderNavbar();
    window.location.hash = '#login-page';
}

function handleHashChange() {
    // ገጹን ከመጫኑ በፊት ሁልጊዜ ዳታውን መጫን
    loadAllData();

    const hash = window.location.hash;

    if (currentUser) {
        currentBalance = currentUser.balance;
    }
    
    renderNavbar();
    
    // ሌሎች ገጾች
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
    } else if (hash === '#user-list-page') { // አዲስ የአድሚን ገጽ
        renderUserListPage();
    } else {
        // ወደ መነሻ ገጽ (ምዝገባ) ይመልሳል
        renderRegisterPage();
    }
}

// ጅምር (Initialization)
window.addEventListener('hashchange', handleHashChange);
window.addEventListener('load', () => {
    // ገጹ ሲከፈት loadAllData() አንድ ጊዜ መጠራቱን እናረጋግጣለን
    loadAllData();
    handleHashChange(); // ገጹን መጫን
});