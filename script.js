// =================================================================
// ETHIO BINGO - FRONT-END JAVASCRIPT LOGIC (script.js)
// የመጨረሻ ማስተካከያዎች:
// 1. የቁጥር ጥሪ በየ 4 ሰከንዱ እንዲሆን ተደርጓል::
// 2. የቢንጎ ህግ: የመጨረሻው ቁጥር ከተጠራ በኋላ Claim ለማድረግ 2 ሰከንድ ብቻ ተሰጥቷል::
// 3. የቁጥር ጥሪ እና የገጽ ማደስ የሚከናወነው ተጫዋቹ በ'#bingo-game-page' ላይ ሲሆን ብቻ መሆኑን ማረጋገጥ::
// 4. የዳታ ዘላቂነት (Data Persistence) በLocal Storage ተተግብሯል::
// 5. ተጫዋቹ ራሱ በተጠራው ቁጥር ላይ ምልክት ያደርጋል::
// 6. "ቢንጎ ለማለት ቆይታ" የሚለው መልዕክት ተወግዷል::
// 7. **አዲስ ለውጥ:** ካርዱ ላይ ሲያጠቁር "ቢንጎ ተገኝቷል" የሚለው መልዕክት እንዳይታይ ተደርጓል::
// =================================================================

// 1. ግሎባል ተለዋዋጮች (Global Variables)
let isLoggedIn = false; 
let currentBalance = 0.00; 
let currentUser = null; 
let pendingRecharges = []; 
let pendingWithdrawals = []; 
let isAdmin = false; 
const appContainer = document.getElementById('app-container');
const navContainer = document.getElementById('main-nav'); 
const adminTelebirrPhone = '0922675655'; 
const adminTelebirrName = 'ሚኪያስ'; 

// የቢንጎ ጨዋታ ግሎባል ተለዋዋጮች
let BINGO_ALL_CARDS = []; // 200 ካርዶች እዚህ ይኖራሉ
let BINGO_NUMBERS_CALLED = []; // የተጠሩ ቁጥሮች ታሪክ
let BINGO_LAST_CALLED_NUMBER = null; // የመጨረሻ የተጠራ ቁጥር ብቻ (ቁጥር)
let BINGO_LAST_CALLED_DISPLAY = null; // የመጨረሻ የተጠራ ቁጥር በፊደልና ቁጥር (ለምሳሌ: B10)

// BINGO_USER_CARDS የአሁኑ ተጠቃሚ የመረጣቸውን ካርዶች ይይዛል (ከፍተኛ 2)
let BINGO_USER_CARDS = []; 

// በሁሉም ተጠቃሚዎች የተመረጡ ካርዶችን ይይዛል
// Object Map: { cardId: userPhone }
let BINGO_SELECTED_CARD_OWNERS = {}; 

let BINGO_TICKET_PRICE = 10.00; // የካርድ መምረጫ ዋጋ

let BINGO_GAME_RUNNING = false; // እውነተኛው ጨዋታ (ቁጥር መጥራት) እየሮጠ ነው?
let BINGO_CARD_SELECTION_PHASE = true; // ካርድ መምረጫው ክፍት ነው?

let BINGO_TIMER_INTERVAL = null; 
let BINGO_NUMBERS_CALL_INTERVAL = null; 
let BINGO_TIMER_SECONDS = 30; // የ30 ሰከንዱ ቆጣሪ መጀመሪያ
// BINGO_PAUSED_FOR_CLAIM: false - መደበኛ ሩጫ; true - ለአፍታ ቆሟል (2 ሰከንድ); 'CLAIMED' - Claim ገብቷል
let BINGO_PAUSED_FOR_CLAIM = false; 
const MAX_CARDS = 2; // አንድ ሰው መግዛት የሚችለው ከፍተኛ የካርድ ብዛት

// የተመዘገቡ ተጠቃሚዎችን መረጃ ለማስቀመጥ (ለመጀመሪያ ጊዜ የሚጫነው)
const registeredUsers = [
    // የአድሚን መለያ 
    { phone: adminTelebirrPhone, password: 'adminpass', name: adminTelebirrName, balance: 1000.00, referralCode: 'ET95655123' } 
];

// ******************************************************
// ** ወሳኝ ቅድመ ዝግጅት: 200 ካርዶችን ወዲያውኑ መፍጠር **
// ******************************************************
function generateBingoCard(id) {
    const card = { id: id, numbers: {}, marked: {}, isBingo: false };
    const ranges = { 'B': [1, 15], 'I': [16, 30], 'N': [31, 45], 'G': [46, 60], 'O': [61, 75] };
    const letters = ['B', 'I', 'N', 'G', 'O'];

    letters.forEach((letter, colIndex) => {
        const [min, max] = ranges[letter];
        const columnNumbers = [];
        
        while(columnNumbers.length < 5) {
            const num = Math.floor(Math.random() * (max - min + 1)) + min;
            if (!columnNumbers.includes(num)) {
                columnNumbers.push(num);
            }
        }
        
        columnNumbers.forEach((num, rowIndex) => {
            const key = `${letter}${rowIndex}`;
            if (letter === 'N' && rowIndex === 2) {
                card.numbers[key] = 'FREE'; 
                card.marked[key] = true; // ነጻው ቦታ ሁልጊዜ ምልክት ይደረግበታል
            } else {
                card.numbers[key] = num;
                card.marked[key] = false;
            }
        });
    });
    
    return card;
}

function setupAllBingoCards() {
    // ካርዶቹ አንዴ ከተፈጠሩ በድጋሚ አይፈጠሩም
    if (BINGO_ALL_CARDS.length === 0) {
        for (let i = 1; i <= 200; i++) {
            BINGO_ALL_CARDS.push(generateBingoCard(i));
        }
    }
}
// ካርዶችን ገጹ ከመጫኑ በፊት እንፍጠር
setupAllBingoCards(); 

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

function saveAllData() {
    // የተጠቃሚዎችን እና የግብይት መረጃዎችን በ Local Storage ውስጥ ያስቀምጣል
    localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));
    localStorage.setItem('pendingRecharges', JSON.stringify(pendingRecharges));
    localStorage.setItem('pendingWithdrawals', JSON.stringify(pendingWithdrawals));
    
    // የጨዋታ ሁኔታዎችን ማስቀመጥ
    localStorage.setItem('BINGO_NUMBERS_CALLED', JSON.stringify(BINGO_NUMBERS_CALLED));
    localStorage.setItem('BINGO_SELECTED_CARD_OWNERS', JSON.stringify(BINGO_SELECTED_CARD_OWNERS));
    localStorage.setItem('BINGO_USER_CARDS', JSON.stringify(BINGO_USER_CARDS)); // የተጠቃሚውን ካርድ ያስቀምጣል
    localStorage.setItem('BINGO_LAST_CALLED_NUMBER', BINGO_LAST_CALLED_NUMBER);
    localStorage.setItem('BINGO_LAST_CALLED_DISPLAY', BINGO_LAST_CALLED_DISPLAY);
    localStorage.setItem('BINGO_GAME_RUNNING', BINGO_GAME_RUNNING);
    localStorage.setItem('BINGO_CARD_SELECTION_PHASE', BINGO_CARD_SELECTION_PHASE);
    localStorage.setItem('BINGO_PAUSED_FOR_CLAIM', BINGO_PAUSED_FOR_CLAIM);
    
    // የአሁን ተጠቃሚ ካለ ያስቀምጣል
    if (currentUser) {
        localStorage.setItem('currentUserPhone', currentUser.phone);
    } else {
        localStorage.removeItem('currentUserPhone');
    }
}

function loadAllData() {
    // መረጃዎችን ከ Local Storage ውስጥ ይጭናል
    const savedUsers = localStorage.getItem('registeredUsers');
    const savedRecharges = localStorage.getItem('pendingRecharges');
    const savedWithdrawals = localStorage.getItem('pendingWithdrawals');
    const savedCurrentUserPhone = localStorage.getItem('currentUserPhone');

    // 1. የተጠቃሚዎችን መረጃ መጫን
    if (savedUsers) {
        const loadedUsers = JSON.parse(savedUsers);
        const adminUser = loadedUsers.find(u => u.phone === adminTelebirrPhone);
        
        // ነባሪውን የአድሚን መለያ ከሌለ ማስገባት
        if (!adminUser) {
            registeredUsers.splice(0, registeredUsers.length, ...loadedUsers, 
                { phone: adminTelebirrPhone, password: 'adminpass', name: adminTelebirrName, balance: 1000.00, referralCode: 'ET95655123' });
        } else {
            // ነባሪውን የአድሚን መለያ እንዳይደገም በማረጋገጥ መረጃውን ይጭናል
            const filteredUsers = loadedUsers.filter(u => u.phone !== adminTelebirrPhone);
            registeredUsers.splice(0, registeredUsers.length, ...filteredUsers);
            if (!registeredUsers.some(u => u.phone === adminTelebirrPhone)) {
                 registeredUsers.push({ phone: adminTelebirrPhone, password: 'adminpass', name: adminTelebirrName, balance: 1000.00, referralCode: 'ET95655123' });
            }
        }


        if (savedCurrentUserPhone) {
            currentUser = registeredUsers.find(user => user.phone === savedCurrentUserPhone);
            if (currentUser) {
                isLoggedIn = true;
                currentBalance = currentUser.balance;
                isAdmin = (currentUser.phone === adminTelebirrPhone);
            }
        }
    }
    
    // 2. የግብይት መረጃዎችን መጫን
    if (savedRecharges) {
        pendingRecharges.splice(0, pendingRecharges.length, ...JSON.parse(savedRecharges));
    }
    
    if (savedWithdrawals) {
        pendingWithdrawals.splice(0, pendingWithdrawals.length, ...JSON.parse(savedWithdrawals));
    }
    
    // 3. የጨዋታ ሁኔታዎችን መጫን
    const savedCalledNumbers = localStorage.getItem('BINGO_NUMBERS_CALLED');
    if (savedCalledNumbers) {
        BINGO_NUMBERS_CALLED = JSON.parse(savedCalledNumbers);
    }
    
    const savedSelectedOwners = localStorage.getItem('BINGO_SELECTED_CARD_OWNERS');
    if (savedSelectedOwners) {
        BINGO_SELECTED_CARD_OWNERS = JSON.parse(savedSelectedOwners);
    }
    
    const savedUserCards = localStorage.getItem('BINGO_USER_CARDS');
    if (savedUserCards) {
        BINGO_USER_CARDS = JSON.parse(savedUserCards);
    }
    
    BINGO_LAST_CALLED_NUMBER = localStorage.getItem('BINGO_LAST_CALLED_NUMBER');
    BINGO_LAST_CALLED_DISPLAY = localStorage.getItem('BINGO_LAST_CALLED_DISPLAY');
    BINGO_GAME_RUNNING = localStorage.getItem('BINGO_GAME_RUNNING') === 'true';
    BINGO_CARD_SELECTION_PHASE = localStorage.getItem('BINGO_CARD_SELECTION_PHASE') === 'true';
    // BINGO_PAUSED_FOR_CLAIMን በትክክል መጫን
    const savedPausedForClaim = localStorage.getItem('BINGO_PAUSED_FOR_CLAIM');
    BINGO_PAUSED_FOR_CLAIM = savedPausedForClaim === 'true' ? true : (savedPausedForClaim === 'CLAIMED' ? 'CLAIMED' : false);

}


// ----------------------------------------------------
// 3. የጨዋታ ቆጣሪ እና ሎጂክ (Timer and Game Logic) - ተሻሽሏል!
// ----------------------------------------------------

function getLetterForNumber(number) {
    if (number >= 1 && number <= 15) return 'B';
    if (number >= 16 && number <= 30) return 'I';
    if (number >= 31 && number <= 45) return 'N';
    if (number >= 46 && number <= 60) return 'G';
    if (number >= 61 && number <= 75) return 'O';
    return '?';
}

function startNumberCalling() {
    if (BINGO_NUMBERS_CALL_INTERVAL) {
        clearInterval(BINGO_NUMBERS_CALL_INTERVAL);
    }
    
    // በየ 4 ሰከንዱ (4000ms) አዲስ ቁጥር መጥራት የሚጀምረው
    BINGO_NUMBERS_CALL_INTERVAL = setInterval(() => {
        // ቁጥር መጥራት የሚቻለው ጨዋታው እየሮጠ እና Claim በመጠባበቅ ላይ ካልሆነ ብቻ ነው!
        if (!BINGO_GAME_RUNNING || BINGO_PAUSED_FOR_CLAIM === true || BINGO_PAUSED_FOR_CLAIM === 'CLAIMED') return;

        const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1)
            .filter(num => !BINGO_NUMBERS_CALLED.includes(num));

        if (availableNumbers.length === 0) {
            // ሁሉም ቁጥሮች ከተጠሩ ጨዋታውን ማቆም
            clearInterval(BINGO_NUMBERS_CALL_INTERVAL);
            BINGO_GAME_RUNNING = false;
            BINGO_LAST_CALLED_NUMBER = "END";
            BINGO_LAST_CALLED_DISPLAY = "END";
            saveAllData(); 
            alert("ሁሉም ቁጥሮች ተጠርተዋል! ጨዋታው ተጠናቋል::");
            if (window.location.hash === '#bingo-game-page') {
                renderActiveGamePage(); 
            }
            return;
        }

        // 1. ለአፍታ ማቆም (ለተጫዋቹ ቢንጎ ለማለት እድል መስጠት) - 2 ሰከንድ
        BINGO_PAUSED_FOR_CLAIM = true; // ቁጥር መጥራትን ያቆማል
        
        // ገጹን ማደስ (የቆይታ መልዕክቱ አሁን አይታይም!)
        if (window.location.hash === '#bingo-game-page') {
             // የተጫዋቹን ገጽ በማደስ (መልዕክቱ እንዲደበቅ ተደርጓል)
             renderActiveGamePage(); 
        }

        setTimeout(() => {
            // 2. ቆይታው አለቀ:: በዚህ ጊዜ Claim ካልመጣ ቁጥር መጥራት ይቀጥላል
            
            if (BINGO_PAUSED_FOR_CLAIM === true) {
                // በዚህ 2 ሰከንድ ውስጥ Claim ካልተላከ (አሁንም TRUE ከሆነ)
                
                // አዲስ ቁጥር መምረጥና መጥራት
                const randomIndex = Math.floor(Math.random() * availableNumbers.length);
                const newNumber = availableNumbers[randomIndex];
                const letter = getLetterForNumber(newNumber);
                
                BINGO_NUMBERS_CALLED.push(newNumber);
                BINGO_LAST_CALLED_NUMBER = newNumber;
                BINGO_LAST_CALLED_DISPLAY = `${letter}${newNumber}`; 
                
                // 3. Claim የማድረግ እድሉ እንዳለፈ ማመልከት
                BINGO_PAUSED_FOR_CLAIM = false; 

                saveAllData(); 
                
                // ገጹን ማደስ
                if (window.location.hash === '#bingo-game-page' && !BINGO_CARD_SELECTION_PHASE) {
                    renderActiveGamePage();
                }
            } 
            // else: Claim ተደርጓል ማለት ነው (BINGO_PAUSED_FOR_CLAIM ወደ 'CLAIMED' ተቀይሯል)
            // ስለዚህ ቁጥር መጥራቱ አይቀጥልም::

        }, 2000); // 2 ሰከንድ ቆይታ

    }, 4000); // በየ 4 ሰከንዱ (አጠቃላይ የቁጥር ጥሪ ዑደት)
}

function startContinuousTimer() {
    if (BINGO_TIMER_INTERVAL) {
        clearInterval(BINGO_TIMER_INTERVAL);
    }
    
    // የቁጥር መጥራቱ ተቋርጦ ከሆነ፣ ጨዋታው Running ላይ ከሆነ መልሰን እንጀምረዋለን
    if (BINGO_GAME_RUNNING && !BINGO_CARD_SELECTION_PHASE && BINGO_LAST_CALLED_NUMBER !== "END" && !BINGO_NUMBERS_CALL_INTERVAL && BINGO_PAUSED_FOR_CLAIM === false) {
         startNumberCalling();
    }
    
    renderNavbar();

    BINGO_TIMER_INTERVAL = setInterval(() => {
        BINGO_TIMER_SECONDS--;
        
        // ቆጣሪው ዜሮ ሲደርስ - የጨዋታ ምዕራፍ መቀየር ሎጂክ
        if (BINGO_TIMER_SECONDS <= 0) {
            BINGO_TIMER_SECONDS = 30; // ወደ 30 ሰከንድ መመለስ

            if (BINGO_CARD_SELECTION_PHASE) {
                // የካርድ መምረጫው ሰዓት አለቀ
                BINGO_CARD_SELECTION_PHASE = false;
                BINGO_GAME_RUNNING = true;
                
                // ቁጥር መጥራትን መጀመር
                startNumberCalling(); 
                
                // ገጹን ወዲያውኑ ወደ Active Game Page መቀየር
                if (currentUser && BINGO_USER_CARDS.length > 0) {
                    window.location.hash = '#bingo-game-page';
                    renderActiveGamePage(); 
                } else {
                     // ካርድ ያልገዛ ተጫዋች ወደ መምረጫው ገጽ ይመለሳል
                    window.location.hash = '#bingo-game-page';
                    renderBingoPage();
                }
                
                saveAllData(); // ዳታ ማስቀመጥ
                alert("የካርድ መምረጫ ሰዓት ተጠናቋል! ቁጥሮች መጥራት ተጀምሯል::");

            } 
            // else: የቁጥር መጥሪያ ምዕራፍ ላይ ከሆነ ቆጣሪው አሁንም ለሌላ ተግባር እንዲኖር ይቆያል

        }
        
        // ቆጣሪውን በNavbar ላይ ማዘመን
        renderNavbar(); 
        
        // በካርድ መምረጫ ገጽ ላይ ያለ ተጫዋች ካለ ማሳያውን አዘምን
        if (window.location.hash === '#bingo-game-page' && BINGO_CARD_SELECTION_PHASE) {
             updateSelectedCardsDisplay();
        }


    }, 1000); // በየ 1 ሰከንዱ ይቁጠር
}

function updateSelectedCardsDisplay() {
    const displayElement = document.getElementById('selected-cards-info');
    if (!displayElement) return;

    const selectedCardIDs = BINGO_USER_CARDS.map(c => c.id);
    const selectedCardsHtml = selectedCardIDs.length > 0
        ? `<p style="font-size: 1.2em; font-weight: bold; color: #004a99;">የተመረጡ ካርዶች ቁጥር: <span style="background-color: #ffd700; padding: 3px 8px; border-radius: 4px; color: #333;">${selectedCardIDs.join('</span> እና <span style="background-color: #ffd700; padding: 3px 8px; border-radius: 4px; color: #333;">')}</span></p>`
        : `<p style="font-size: 1.1em; color: #cc0000;">እባክዎ እስከ ${MAX_CARDS} ካርዶች ይምረጡ።</p>`;

    displayElement.innerHTML = selectedCardsHtml;
}


// ----------------------------------------------------
// 4. ገጽን የሚፈጥሩ ፋንክሽኖች (Page Renderers)
// ----------------------------------------------------

function renderNavbar() {
    if (!navContainer) return; 
    let navHtml = '';
    const currentHash = window.location.hash;
    
    let timerMessage = BINGO_CARD_SELECTION_PHASE ? `ምርጫ ይቀራል` : (BINGO_GAME_RUNNING ? `ቁጥር መጥራት` : `ጨዋታ ጠፍቷል`);
    let timerStyle = BINGO_CARD_SELECTION_PHASE ? (BINGO_TIMER_SECONDS <= 5 ? '#cc0000' : '#008080') : (BINGO_GAME_RUNNING ? '#9933cc' : '#555');
    
    // የ 30 ሰከንዱን ቆጣሪ HTML መፍጠር
    const timerDisplay = `
        <span id="bingo-timer" style="margin-left: 10px; padding: 5px 10px; background-color: ${timerStyle}; color: white; border-radius: 5px; font-weight: bold; min-width: 120px; text-align: center; display: inline-flex; align-items: center; justify-content: center;">
            <i class="fas fa-hourglass-half" style="margin-right: 5px;"></i> ${timerMessage}: ${BINGO_TIMER_SECONDS}${BINGO_CARD_SELECTION_PHASE ? 's' : ''}
        </span>
    `;

    const balanceDisplay = isLoggedIn ? 
        `<span style="margin-left: 10px; padding: 5px 10px; background-color: #f7b731; color: #333; border-radius: 5px; font-weight: bold;">Wallet: ETB ${currentBalance.toFixed(2)}</span>` : '';

    if (isLoggedIn) {
        navHtml = `
            <a href="#account-page" class="${currentHash === '#account-page' ? 'active' : ''}">
                <i class="fas fa-user-circle"></i> የኔ መለያ
            </a>
            <a href="#bingo-game-page" class="${currentHash === '#bingo-game-page' ? 'active' : ''}">
                <i class="fas fa-dice"></i> ጨዋታ
            </a>
            ${timerDisplay} 
            ${balanceDisplay}
            <button onclick="handleLogout()" style="background: none; border: none; color: #fff; cursor: pointer; padding: 10px 15px; font-size: 1em;">
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
            ${timerDisplay} 
        `;
    }
    
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
        }

        link.onmouseover = function() { this.style.backgroundColor = '#555'; };
        link.onmouseout = function() { 
            if (link.tagName === 'A' && this.classList.contains('active')) {
                this.style.backgroundColor = '#004a99';
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
    const name = document.getElementById('reg-name').value.trim(); 
    const phone = document.getElementById('reg-phone').value;
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value; 
    const inviteCode = document.getElementById('reg-invite').value.trim().toUpperCase(); 
    if (password !== confirmPassword) { alert('የይለፍ ቃሉ እና የማረጋገጫ ይለፍ ቃሉ አይመሳሰለሉም! እባክዎ በትክክል ያስገቡ።'); return; }
    if (name.length < 2) { alert('እባክዎ ትክክለኛ ስምዎን ያስገቡ።'); return; }
    if (registeredUsers.some(user => user.phone === phone)) { alert(`ይህ ስልክ ቁጥር (${phone}) አስቀድሞ ተመዝግቧል። ወደ መግቢያ ገጽ ይሂዱ።`); return; }
    const newReferralCode = generateReferralCode(phone);
    
    const newUser = { phone: phone, password: password, name: name, balance: 0.00, referralCode: newReferralCode };
    registeredUsers.push(newUser);
    
    let rewardMessage = '';
    if (inviteCode) {
        const referrer = registeredUsers.find(user => user.referralCode === inviteCode);
        if (referrer && referrer.phone !== phone) {
            const rewardAmount = 10.00;
            referrer.balance += rewardAmount; 
            rewardMessage = `እና ጋባዥዎ (${referrer.name}) በ ${rewardAmount.toFixed(2)} ETB ሽልማት አግኝተዋል።`;
        } else if (referrer && referrer.phone === phone) { alert("የራስዎን ስልክ ቁጥር ወይም ኮድ መጠቀም አይችሉም!"); } 
        else { alert("ያስገቡት የመጋበዣ ኮድ ትክክል አይደለም።"); }
    }
    
    saveAllData(); // ዳታ ማስቀመጥ
    
    alert(`በተሳካ ሁኔታ ተመዝግበዋል! አሁን መግባት ይችላሉ። ${rewardMessage}`);
    window.location.hash = '#login-page'; 
}
function renderLoginPage() {
    appContainer.innerHTML = `<div class="page-container"><h2>ወደ መለያዎ ይግቡ</h2><form id="login-form"><div class="form-group"><label for="log-phone"><i class="fas fa-phone"></i> ስልክ ቁጥር:</label><input type="tel" id="log-phone" name="phone" required></div><div class="form-group"><label for="log-password"><i class="fas fa-lock"></i> የይለፍ ቃል:</label><input type="password" id="log-password" name="password" required></div><button type="submit" class="submit-button">ግባ</button></form><p style="margin-top: 15px;">አዲስ ነዎት? <a href="#register-page">ይመዝገቡ</a></p></div>`;
    document.getElementById('login-form').addEventListener('submit', handleLogin);
}
function handleLogin(e) {
    e.preventDefault();
    const phone = document.getElementById('log-phone').value;
    const password = document.getElementById('log-password').value;
    const userFound = registeredUsers.find(user => user.phone === phone && user.password === password);
    if (userFound) {
        currentUser = userFound;
        currentBalance = currentUser.balance; 
        isAdmin = (phone === adminTelebirrPhone);
        alert(isAdmin ? 'በአድሚንነት ገብተዋል!' : 'በተጠቃሚነት ገብተዋል!');
        isLoggedIn = true;
        
        saveAllData(); // ዳታ ማስቀመጥ
        
        renderNavbar(); 
        window.location.hash = '#account-page';
    } else {
        alert('ስልክ ቁጥር ወይም የይለፍ ቃል ትክክል አይደለም። ወይም አልተመዘገቡም።');
        isLoggedIn = false;
        isAdmin = false;
        currentUser = null;
        saveAllData(); // ዳታ ማስቀመጥ
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
    const amount = document.getElementById('recharge-amount').value;
    const transactionId = document.getElementById('transaction-id').value;
    const numAmount = parseFloat(amount);
    if (numAmount < 10) { alert("ቢያንስ 10 ETB ማስገባት አለብዎት።"); return; }
    if (transactionId.length < 5) { alert("እባክዎ ትክክለኛ የግብይት መለያ ቁጥር (Transaction ID) ያስገቡ።"); return; }
    const request = { id: Date.now(), userPhone: currentUser.phone, amount: numAmount, transactionId: transactionId, date: new Date().toLocaleString('am-ET'), status: 'Pending' };
    pendingRecharges.push(request); 
    
    saveAllData(); // ዳታ ማስቀመጥ
    
    alert(`የ ETB ${numAmount.toFixed(2)} ማስገቢያ ጥያቄዎ በተሳካ ሁኔታ ተልኳል።`);
    window.location.hash = '#account-page';
}
function confirmRecharge(requestId, amount, userPhone) {
    if (!isAdmin) { alert("ይህንን ተግባር ማከናወን የሚችሉት አድሚኖች ብቻ ናቸው!"); return; }
    if (!confirm(`ይህንን የ ${amount.toFixed(2)} ETB ገቢ በእርግጥ ለተጠቃሚ ${userPhone} ማረጋገጥ ይፈልጋሉ?`)) { return; }
    const targetUser = registeredUsers.find(user => user.phone === userPhone);
    if (targetUser) {
        targetUser.balance += amount; 
        if (currentUser.phone === userPhone) { currentUser.balance = targetUser.balance; }
        alert(`ETB ${amount.toFixed(2)} በተሳካ ሁኔታ ወደ ተጠቃሚ ${userPhone} ሂሳብ ገብቷል።`);
    } else { alert(`ስልክ ቁጥር ${userPhone} ያለው ተጠቃሚ አልተገኘም!`); }
    pendingRecharges = pendingRecharges.filter(req => req.id !== requestId);
    
    saveAllData(); // ዳታ ማስቀመጥ
    
    renderAccountPage();
}
function handleWithdraw(e) {
    e.preventDefault();
    const bank = document.getElementById('withdraw-bank').value;
    const account = document.getElementById('withdraw-account').value;
    const name = document.getElementById('withdraw-name').value;
    const amount = document.getElementById('withdraw-amount').value;
    const numAmount = parseFloat(amount);
    if (numAmount < 10) { alert("ቢያንስ 10 ETB ማውጣት አለብዎት።"); return; }
    if (numAmount > currentUser.balance) { alert("በመለያዎ ውስጥ በቂ ገንዘብ የለም! ቀሪ ሂሳብ: ETB " + currentUser.balance.toFixed(2)); return; }
    currentUser.balance -= numAmount; 
    currentBalance = currentUser.balance; 
    const request = { id: Date.now(), userPhone: currentUser.phone, userName: currentUser.name, amount: numAmount, bank: bank, account: account, accountName: name, date: new Date().toLocaleString('am-ET'), status: 'Pending' };
    pendingWithdrawals.push(request); 
    
    saveAllData(); // ዳታ ማስቀመጥ
    
    alert(`የ ETB ${numAmount.toFixed(2)} የማውጫ ጥያቄዎ በተሳካ ሁኔታ ተልኳል።`);
    window.location.hash = '#account-page';
}
function confirmWithdrawal(requestId) {
    if (!isAdmin) { alert("ይህንን ተግባር ማከናወን የሚችሉት አድሚኖች ብቻ ናቸው!"); return; }
    const request = pendingWithdrawals.find(req => req.id === requestId);
    if (!request) { alert("ይህ የማውጫ ጥያቄ አልተገኘም!"); return; }
    if (!confirm(`ገንዘቡን ለተጠቃሚው ${request.userPhone} ወደ ${request.bank} አካውንት ${request.account} አስተላልፈዋል?`)) { return; }
    pendingWithdrawals = pendingWithdrawals.filter(req => req.id !== requestId);
    
    saveAllData(); // ዳታ ማስቀመጥ
    
    renderAccountPage();
}
function renderAccountPage() {
    if (!isLoggedIn || !currentUser) { alert('መጀመሪያ ይግቡ!'); window.location.hash = '#login-page'; return; }
    currentBalance = currentUser.balance; 
    function getConfirmButton(reqId, reqAmount, reqPhone, type) {
        if (isAdmin) {
            if (type === 'recharge') {
                 return `<button onclick="confirmRecharge(${reqId}, ${reqAmount}, '${reqPhone}')" style="flex-basis: 25%; padding: 5px; background-color: #38761d; color: white; border: none; border-radius: 4px; cursor: pointer;">ገቢ አረጋግጥ</button>`;
            } else if (type === 'withdraw') {
                 return `<button onclick="confirmWithdrawal(${reqId})" style="flex-basis: 25%; padding: 5px; background-color: #004a99; color: white; border: none; border-radius: 4px; cursor: pointer;">ክፍያ አረጋግጥ</button>`;
            }
        }
        return '<span style="color: red; font-weight: bold;">በመጠባበቅ ላይ...</span>';
    }
    const pendingRechargeHtml = pendingRecharges.length > 0 ? `<h3 style="margin-top: 20px; color: #cc0000;"><i class="fas fa-clock"></i> በመጠባበቅ ላይ ያሉ ገቢዎች:</h3><ul style="list-style-type: none; padding: 0;">${pendingRecharges.map(req => {
        if (!isAdmin && req.userPhone !== currentUser.phone) return ''; 
        return `<li style="border: 1px dashed #ffcc00; padding: 10px; margin-bottom: 5px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;"><div style="flex-basis: ${isAdmin ? '70%' : '100%'}; text-align: left;"><strong>+${req.amount.toFixed(2)} ETB</strong> - ID: <span style="font-weight: bold; color: #004a99;">${req.transactionId}</span>${isAdmin ? `<br><span style="font-size: 0.9em; color: #008080;">ለ: ${req.userPhone}</span>` : ''}<br><span style="font-size: 0.8em; color: #888;">ጥያቄ የላኩበት: ${req.date}</span></div>${getConfirmButton(req.id, req.amount, req.userPhone, 'recharge')}</li>`;
    }).join('')}</ul>` : '';
    const pendingWithdrawalHtml = pendingWithdrawals.length > 0 ? `<h3 style="margin-top: 20px; color: #9933cc;"><i class="fas fa-hourglass-half"></i> በመጠባበቅ ላይ ያሉ ገንዘብ ማውጫዎች:</h3><ul style="list-style-type: none; padding: 0;">${pendingWithdrawals.map(req => {
         if (!isAdmin && req.userPhone !== currentUser.phone) return ''; 
        return `<li style="border: 1px dashed #9933cc; padding: 10px; margin-bottom: 5px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;"><div style="flex-basis: ${isAdmin ? '70%' : '100%'}; text-align: left;"><strong>-ETB ${req.amount.toFixed(2)}</strong> (${req.bank})<br>${isAdmin ? `<span style="font-size: 0.9em; color: #008080;">ለ: ${req.accountName} (${req.account})</span><br>` : ''}<span style="font-size: 0.8em; color: #888;">ጥያቄ የላኩበት: ${req.date}</span></span></div>${getConfirmButton(req.id, req.amount, req.userPhone, 'withdraw')}</li>`;
    }).join('')}</ul>` : '';

    appContainer.innerHTML = `<div class="page-container"><h2><i class="fas fa-user-circle"></i> የኔ መለያ ${isAdmin ? ' (Admin)' : ''}</h2><div class="account-info"><h3>የግል መለያ መረጃ:</h3><p><strong>ስልክ ቁጥር:</strong> ${currentUser.phone}</p><p><strong>መታወቂያ (ID):</strong> ETB12345</p><p><strong>የተመዘገበበት ስም:</strong> ${currentUser.name}</p><p class="referral-code-info"><strong>የእርስዎ መጋበዣ ኮድ:</strong> <span id="my-referral-code" style="font-weight: bold; color: #004a99; cursor: pointer;" onclick="copyReferralCode('${currentUser.referralCode}')">${currentUser.referralCode || 'አልተሰጠም'} <i class="fas fa-copy"></i></span></p><p id="copy-message" style="color: green; font-size: 0.9em; margin-top: 5px; display: none;">ኮዱ ተቀድቷል!</p><h3 style="margin-top: 15px;">የቀሪ ሂሳብዎ:</h3><p class="balance">ETB ${currentBalance.toFixed(2)}</p><div class="btn-group"><button class="btn-recharge" onclick="window.location.hash = '#recharge-form-page'"><i class="fas fa-plus-circle"></i> ገንዘብ አስገባ</button><button class="btn-withdraw" onclick="window.location.hash = '#withdraw-form-page'"><i class="fas fa-minus-circle"></i> ገንዘብ አውጣ</button></div><div class="btn-group" style="margin-top: 20px; border-top: 1px solid #eee; padding-top: 15px;"><button class="submit-button" style="background-color: #008000; color: white;" onclick="window.location.hash = '#bingo-game-page'"><i class="fas fa-dice"></i> ወደ ጨዋታው ገጽ</button></div></div><div class="transaction-section"><h3><i class="fas fa-history"></i> የግብይት ታሪክ (ናሙና):</h3><ul><li>-ETB 10.00 - Bingo ውርርድ</li><li>+ETB 5.00 - ኮሚሽን</li></ul>${pendingRechargeHtml}${pendingWithdrawalHtml}</div><button class="submit-button" style="background-color: #cc0000; color: white; margin-top: 20px;" onclick="handleLogout()"><i class="fas fa-sign-out-alt"></i> ውጣ</button></div>`;
}

function handleLogout() {
    isLoggedIn = false;
    isAdmin = false;
    currentUser = null;
    currentBalance = 0.00;
    
    // የጨዋታ ሁኔታዎችን ማጥፋት እና ወደ መጀመሪያው ሁኔታ መመለስ
    // የተገዙ ካርዶች እና የጨዋታው ሁኔታዎች እንዳይቀመጡ እንወስናለን (ለአዲስ ዙር መዘጋጀት)
    BINGO_GAME_RUNNING = false;
    BINGO_CARD_SELECTION_PHASE = true;
    BINGO_PAUSED_FOR_CLAIM = false;
    BINGO_NUMBERS_CALLED = [];
    BINGO_LAST_CALLED_NUMBER = null;
    BINGO_LAST_CALLED_DISPLAY = null;
    BINGO_USER_CARDS = []; 
    BINGO_SELECTED_CARD_OWNERS = {};
    
    clearInterval(BINGO_NUMBERS_CALL_INTERVAL); 
    
    saveAllData(); // ዳታ ማስቀመጥ (logout ሲደረግ userPhone ይጠፋል)

    alert('ከመለያዎ ወጥተዋል::');
    renderNavbar(); 
    window.location.hash = '#login-page';
}

// ----------------------------------------------------
// 5. የካርድ ምርጫ ተግባር (Card Selection Logic)
// ----------------------------------------------------

function handleCardSelection(cardId) {
    if (!isLoggedIn || !currentUser) {
        alert("ካርድ ለመምረጥ እባክዎ መጀመሪያ ይግቡ!");
        window.location.hash = '#login-page';
        return;
    }
    if (!BINGO_CARD_SELECTION_PHASE) {
        alert("የካርድ መምረጫው ሰዓት አብቅቷል! በሚቀጥለው ዙር ይሞክሩ።");
        return;
    }

    const cardIdStr = cardId.toString();
    const isOwned = BINGO_SELECTED_CARD_OWNERS[cardIdStr] === currentUser.phone;
    const isAlreadySelectedByUser = BINGO_USER_CARDS.some(c => c.id === cardId);
    
    // 1. ካርዱ አስቀድሞ በሌላ ሰው ተመርጧል
    if (BINGO_SELECTED_CARD_OWNERS.hasOwnProperty(cardIdStr) && !isOwned) {
        alert(`ይህ ካርድ #${cardId} በሌላ ተጫዋች ተመርጧል! ሌላ ካርድ ይምረጡ።`);
        return;
    }
    
    if (isOwned && isAlreadySelectedByUser) {
        // 2. ካርዱን ከምርጫ ማስወገድ
        const cardIndex = BINGO_USER_CARDS.findIndex(c => c.id === cardId);
        // ገንዘቡን መመለስ
        currentUser.balance += BINGO_TICKET_PRICE;
        currentBalance = currentUser.balance; 
        
        BINGO_USER_CARDS.splice(cardIndex, 1);
        delete BINGO_SELECTED_CARD_OWNERS[cardIdStr];
        
        alert(`ካርድ #${cardId} ከምርጫዎ ተወግዷል። ETB ${BINGO_TICKET_PRICE.toFixed(2)} ተመልሷል::`);
        
        renderNavbar(); 

    } else {
        // 3. አዲስ ካርድ መምረጥ
        
        // **የሂሳብ ፍተሻ**
        if (currentUser.balance < BINGO_TICKET_PRICE) {
            alert(`ካርድ ለመምረጥ በቂ ቀሪ ሂሳብ የለዎትም! ቢያንስ ETB ${BINGO_TICKET_PRICE.toFixed(2)} ያስፈልጋል።`);
            return;
        }

        if (BINGO_USER_CARDS.length < MAX_CARDS) {
            
            // **10 ብር ቅናሽ ማድረግ**
            currentUser.balance -= BINGO_TICKET_PRICE;
            currentBalance = currentUser.balance; // ግሎባል ባላንሱን አዘምን

            const cardToSelect = BINGO_ALL_CARDS.find(c => c.id === cardId);
            
            // የተመረጠው ካርድ ቅጂ እንጂ ኦሪጅናሉ አይደለም
            BINGO_USER_CARDS.push(JSON.parse(JSON.stringify(cardToSelect))); 
            BINGO_SELECTED_CARD_OWNERS[cardIdStr] = currentUser.phone; // የካርዱ ባለቤት መረጃ ይመዘገባል
            
            alert(`ካርድ #${cardId} ተመርጧል! ETB ${BINGO_TICKET_PRICE.toFixed(2)} ተቀንሷል። አዲስ ቀሪ ሂሳብ: ETB ${currentBalance.toFixed(2)}`);
            
            // Navbar እና Account Page ላይ ያለው ቀሪ ሂሳብ እንዲታደስ
            renderNavbar(); 

        } else {
            alert(`ከፍተኛው የካርድ ምርጫ ብዛት (${MAX_CARDS}) ደርሰዋል! ሌላ ለመምረጥ አንዱን ያስወግዱ።`);
        }
    }
    
    saveAllData(); // የካርድ ለውጥን ማስቀመጥ
    
    // የገጹን ይዘት በምርጫ ለውጥ ማዘመን
    renderBingoPage();
}

// ----------------------------------------------------
// 6. የካርድ መምረጫ ገጽ (renderBingoPage) 
// ----------------------------------------------------

function renderSingleCardForSelection(card) {
    const cardIdStr = card.id.toString();
    const cardOwner = BINGO_SELECTED_CARD_OWNERS[cardIdStr];
    
    let isSelected = BINGO_USER_CARDS.some(c => c.id === card.id);
    let isTakenByOther = cardOwner && cardOwner !== (currentUser ? currentUser.phone : null);
    
    let buttonText, buttonColor, cardBorderColor, buttonHtml;
    
    // የካርድ መምረጫ ሰዓት ካለፈ ምርጫን ማቆም
    if (!BINGO_CARD_SELECTION_PHASE) {
        buttonText = "ሰዓቱ አልፏል";
        buttonColor = '#555';
        buttonHtml = `<button disabled style="padding: 5px 10px; background-color: ${buttonColor}; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: not-allowed; font-size: 0.85em;">${buttonText}</button>`;
        cardBorderColor = isSelected ? '3px solid #008000' : '1px solid #ccc';
    } else if (isTakenByOther) {
        // በሌላ ሰው የተመረጠ
        buttonText = 'ተመርጧል';
        buttonColor = '#888'; 
        buttonHtml = `<button disabled style="padding: 5px 10px; background-color: ${buttonColor}; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: not-allowed; font-size: 0.85em;">${buttonText} (በሌላ)</button>`;
        cardBorderColor = '3px solid #ffcc00'; // ቢጫ ድንበር
    } else if (isSelected) {
        // በተጠቃሚው ራሱ የተመረጠ
        buttonText = 'የእርስዎ ምርጫ (አስወግድ)';
        buttonColor = '#cc0000';
        buttonHtml = `<button onclick="handleCardSelection(${card.id})" style="padding: 5px 10px; background-color: ${buttonColor}; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">${buttonText}</button>`;
        cardBorderColor = '3px solid #008000'; // አረንጓዴ ድንበር
    } else {
        // ያልተመረጠ
        buttonText = `ምረጥ (ETB ${BINGO_TICKET_PRICE.toFixed(2)})`;
        buttonColor = '#004a99';
        buttonHtml = `<button onclick="handleCardSelection(${card.id})" style="padding: 5px 10px; background-color: ${buttonColor}; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 0.85em;">${buttonText}</button>`;
        cardBorderColor = '1px solid #ccc';
    }


    // የካርዱን ፍርግርግ ይፍጠሩ
    let cardCellsHtml = '';
    const letters = ['B', 'I', 'N', 'G', 'O'];
    [0, 1, 2, 3, 4].forEach(r => {
        letters.forEach(l => {
            const key = `${l}${r}`;
            const num = card.numbers[key];
            
            let style = `padding: 8px 0; border: 1px solid #eee; font-size: 0.9em; font-weight: normal; background-color: white;`;
            let content = num;

            if (num === 'FREE') {
                 style += 'background-color: #ffff99; font-weight: bold;';
                 content = 'FREE';
            }
            
            cardCellsHtml += `<div style="${style}">${content}</div>`;
        });
    });

    return `
        <div class="card-selector-item" data-card-id="${card.id}" style="width: 190px; margin: 10px; border: ${cardBorderColor}; border-radius: 6px; overflow: hidden; display: inline-block; box-shadow: 2px 2px 5px rgba(0,0,0,0.1);">
            <h4 style="background-color: #004a99; color: white; padding: 5px; margin: 0; text-align: center; font-size: 1em;">ካርድ #${card.id}</h4>
            <div style="display: grid; grid-template-columns: repeat(5, 1fr); text-align: center; font-weight: bold; font-size: 0.8em; background-color: #f0f0f0;">
                <div style="padding: 3px 0;">B</div>
                <div style="padding: 3px 0;">I</div>
                <div style="padding: 3px 0;">N</div>
                <div style="padding: 3px 0;">G</div>
                <div style="padding: 3px 0;">O</div>
            </div>
            <div class="card-grid" style="display: grid; grid-template-columns: repeat(5, 1fr); border-top: 1px solid #ddd;">
                ${cardCellsHtml}
            </div>
            <div style="padding: 5px; text-align: center; background-color: #f8f8f8;">
                 ${buttonHtml}
            </div>
        </div>
    `;
}

function renderBingoPage() {
    if (!isLoggedIn) {
        window.location.hash = '#login-page';
        return;
    }
    
    // የካርድ መምረጫው ሰዓት ካለፈ እና ካርድ ከገዛ ወደ ጨዋታው ገጽ ይውሰድ
    if (!BINGO_CARD_SELECTION_PHASE && BINGO_USER_CARDS.length > 0) {
        renderActiveGamePage();
        return;
    }
    
    setupAllBingoCards(); 

    // የተመረጡ ካርዶች ማሳያ
    const selectedCardIDs = BINGO_USER_CARDS.map(c => c.id);
    const selectionMessage = BINGO_CARD_SELECTION_PHASE ? 
        `<p style="font-size: 1.1em; color: #cc0000; font-weight: bold;">የሚቀጥለው ዙር ከመጀመሩ በፊት ካርድዎን ይምረጡ።</p>` : 
        `<p style="font-size: 1.1em; color: #cc0000; font-weight: bold;">የካርድ መምረጫ ሰዓቱ አብቅቷል።</p>`;
        
    const selectedCardsHtml = selectedCardIDs.length > 0
        ? `<p style="font-size: 1.2em; font-weight: bold; color: #004a99;">የተመረጡ ካርዶች ቁጥር: <span style="background-color: #ffd700; padding: 3px 8px; border-radius: 4px; color: #333;">${selectedCardIDs.join('</span> እና <span style="background-color: #ffd700; padding: 3px 8px; border-radius: 4px; color: #333;">')}</span></p>`
        : `<p style="font-size: 1.1em; color: #cc0000;">እባክዎ እስከ ${MAX_CARDS} ካርዶች ይምረጡ።</p>`;

    // የካርዶችን HTML ማመንጨት (200 ካርዶች)
    const allCardsHtml = BINGO_ALL_CARDS.map(card => renderSingleCardForSelection(card)).join('');

    appContainer.innerHTML = `
        <div class="page-container" style="max-width: 100%; padding: 10px;">
            <h2><i class="fas fa-dice"></i> የቢንጎ ካርድ መምረጫ (ዋጋ: ETB ${BINGO_TICKET_PRICE.toFixed(2)}/ካርድ)</h2>
            
            <div style="text-align: center; margin-bottom: 10px;">
                ${selectionMessage}
            </div>
            
            <div id="selected-cards-info" style="text-align: center; margin-bottom: 20px; padding: 15px; border: 2px dashed #004a99; border-radius: 8px;">
                ${selectedCardsHtml}
            </div>
            
            <div id="all-cards-display" style="text-align: center; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
                <h3>ሁሉንም ካርዶች ይመልከቱ:</h3>
                <div style="display: flex; flex-wrap: wrap; justify-content: center;">
                    ${allCardsHtml}
                </div>
            </div>
        </div>
    `;
}

// ----------------------------------------------------
// 7. የቢንጎ ጨዋታ ገጽ (Active Game Page) - ተጫዋቹ ማርክ የሚያደርግበት
// ----------------------------------------------------

/**
 * **አዲስ ፋንክሽን:** ተጫዋቹ የካርድ ሴል ላይ ክሊክ ሲያደርግ ምልክት የሚያደርግ/የሚያስወግድ
 */
function toggleMark(cardId, key) {
    // ተጫዋቹ ካርድ ላይ የሚነካው በActive Game Page ላይ ብቻ ነው
    if (window.location.hash !== '#bingo-game-page') return; 

    if (!BINGO_GAME_RUNNING || BINGO_PAUSED_FOR_CLAIM === 'CLAIMED') {
        alert("አሁን ምልክት ማድረግ አይቻልም!");
        return;
    }

    const card = BINGO_USER_CARDS.find(c => c.id === cardId);
    if (!card) return;

    const num = card.numbers[key];

    // ነጻው ቦታ ከሆነ ምንም አያድርግ (ሁሌም Marked ነው)
    if (num === 'FREE') return;
    
    // በተጠሩ ቁጥሮች ውስጥ ከሌለ ምልክት እንዲያደርግ/እንዳያስወግድ መፍቀድ (ስህተት ቢሰራ በClaim ጊዜ ይፈተሻል)
    // ካርዱ ላይ ምልክት መደረግ/መወገድ
    card.marked[key] = !card.marked[key];

    saveAllData(); // የካርድ ለውጥን ማስቀመጥ

    // ለውጥ ስላለ ገጹን ማደስ
    if (window.location.hash === '#bingo-game-page') {
        renderActiveGamePage();
    }
}


/**
 * የቢንጎ ማረጋገጫ ሎጂክ: 5 ምልክት የተደረገባቸው ሴሎች በአንድ ረድፍ, አምድ ወይም ሰያፍ መስመር ላይ መኖራቸውን ይፈትሻል.
 * @param {object} card - ለመፈተሽ የሚያገለግለው የቢንጎ ካርድ ኦብጀክት
 * @returns {boolean} - ቢንጎ ከተገኘ true, ካልሆነ false
 */
function checkForBingo(card) {
    const letters = ['B', 'I', 'N', 'G', 'O'];
    const marked = card.marked;
    const isMarked = (l, r) => marked[`${l}${r}`] === true;

    // ረድፎችን መፈተሽ (Rows)
    for (let r = 0; r < 5; r++) {
        if (letters.every(l => isMarked(l, r))) {
            return true;
        }
    }

    // አምዶችን መፈተሽ (Columns)
    for (const l of letters) {
        if ([0, 1, 2, 3, 4].every(r => isMarked(l, r))) {
            return true;
        }
    }

    // የመጀመሪያ ሰያፍ መስመር (Top-Left to Bottom-Right)
    if ([0, 1, 2, 3, 4].every(i => isMarked(letters[i], i))) {
        return true;
    }

    // ሁለተኛ ሰያፍ መስመር (Top-Right to Bottom-Left)
    if ([0, 1, 2, 3, 4].every(i => isMarked(letters[4 - i], i))) {
        return true;
    }

    return false;
}


function renderUserCardForGame(card) {
    // ቢንጎ መሆን አለመሆኑን መፈተሽ
    const isBingo = checkForBingo(card); 
    card.isBingo = isBingo; // የካርድ ኦብጀክቱን ማዘመን

    let cardCellsHtml = '';
    const letters = ['B', 'I', 'N', 'G', 'O'];
    
    [0, 1, 2, 3, 4].forEach(r => {
        letters.forEach(l => {
            const key = `${l}${r}`;
            const num = card.numbers[key];
            const isMarked = card.marked[key];
            const isFree = num === 'FREE';
            
            // የሴል ክሊክ ክስተት
            const clickHandler = `onclick="toggleMark(${card.id}, '${key}')"`;

            let style = `
                padding: 8px 0; 
                border: 1px solid #eee; 
                font-size: 1em; 
                font-weight: bold;
                cursor: pointer; /* ተጫዋቹ እንዲነካው */
                background-color: ${isFree ? '#ffff99' : (isMarked ? '#008000' : 'white')};
                color: ${isMarked && !isFree ? 'white' : 'black'};
                line-height: 1;
            `;
            
            cardCellsHtml += `<div style="${style}" ${isFree ? '' : clickHandler}>${num}</div>`;
        });
    });
    
    // የቢንጎ ጥያቄ ቁልፍ ሁኔታን ማስተካከል
    const claimButtonColor = isBingo ? '#004a99' : '#cc0000';
    const claimButtonText = isBingo ? 'ቢንጎ! (ጥያቄ ላክ)' : 'ቢንጎ ጥያቄ ላክ';
    
    // ቁልፉ የሚሰራው ቢንጎ ካለ እና Claim ካልተላከ ብቻ ነው
    const isClaimable = isBingo && BINGO_GAME_RUNNING && BINGO_PAUSED_FOR_CLAIM !== 'CLAIMED';
    
    return `
        <div class="user-bingo-card" style="width: 250px; margin: 15px; border: 3px solid ${isBingo ? '#008000' : '#004a99'}; border-radius: 8px; overflow: hidden; box-shadow: 4px 4px 10px rgba(0,0,0,0.2);">
            <h3 style="background-color: ${claimButtonColor}; color: white; padding: 10px; margin: 0; text-align: center;">የኔ ካርድ #${card.id}</h3> 
            <div style="display: grid; grid-template-columns: repeat(5, 1fr); text-align: center; font-weight: bold; font-size: 1em; background-color: #f0f0f0;">
                <div style="padding: 5px 0;">B</div>
                <div style="padding: 5px 0;">I</div>
                <div style="padding: 5px 0;">N</div>
                <div style="padding: 5px 0;">G</div>
                <div style="padding: 5px 0;">O</div>
            </div>
            <div class="card-grid" style="display: grid; grid-template-columns: repeat(5, 1fr); border-top: 1px solid #ddd;">
                ${cardCellsHtml}
            </div>
            <div style="padding: 10px; text-align: center; background-color: #f8f8f8;">
                 <button onclick="handleClaimBingo(${card.id})" style="padding: 8px 15px; background-color: ${claimButtonColor}; color: white; border: none; border-radius: 5px; cursor: ${isClaimable ? 'pointer' : 'not-allowed'}; font-weight: bold;" ${!isClaimable ? 'disabled' : ''}>
                    ${claimButtonText}
                 </button>
                 <p style="color: ${isBingo ? '#008000' : '#cc0000'}; font-size: 0.8em; margin: 5px 0 0;">ቢንጎ መስመር ከተሞላ ብቻ ይጫኑ!</p>
            </div>
        </div>
    `;
}

function handleClaimBingo(cardId) {
    if (!BINGO_GAME_RUNNING) {
        alert("ጨዋታው ገና አልተጀመረም/ተጠናቋል!");
        return;
    }
    
    // **አዲስ ህግ:** Claim የማድረግ እድሉ አልፎ ከሆነ ማስጠንቀቂያ መስጠት
    if (!BINGO_PAUSED_FOR_CLAIM) {
         alert("ቢንጎ ለማለት የነበረዎት ጊዜ አልፏል! ሌላ ቁጥር እስኪጠራ ድረስ ይጠብቁ ወይም በሚቀጥለው ጥሪ ወቅት ወዲያውኑ ይጠይቁ::");
         return;
    }
    
    if (BINGO_PAUSED_FOR_CLAIM === 'CLAIMED') {
         alert("ሌላ የቢንጎ ጥያቄ በመጠባበቅ ላይ ነው!");
         return;
    }
    
    const card = BINGO_USER_CARDS.find(c => c.id === cardId);
    if (!card) return;

    // 1. መደበኛ ቢንጎ መኖሩን ማረጋገጥ
    if (!checkForBingo(card)) {
        alert("ይቅርታ! የቢንጎ መስመር አልተሞላም። ምልክት የተደረገባቸውን ቦታዎች ያረጋግጡ::");
        return;
    }
    
    // **2. ተጫዋቹ ምልክት ያደረገባቸው ቁጥሮች ሁሉ በተጠሩ ቁጥሮች ውስጥ መኖራቸውን ማረጋገጥ**
    for (const key in card.marked) {
        if (card.marked[key]) {
            const num = card.numbers[key];
            
            // 'FREE' ቦታ ካልሆነ እና ቁጥሩ ከተጠሩት ውስጥ ካልሆነ (ስህተት ማርክ አድርጓል)
            if (num !== 'FREE' && !BINGO_NUMBERS_CALLED.includes(num)) {
                alert("❌ ስህተት! ገና ያልተጠራ ቁጥር ላይ ምልክት አድርገዋል። ቢንጎው ተቀባይነት የለውም!");
                
                // ካርዱን እንደገና ማደስ (ስህተት ምልክት ያደረገበት ቦታ ሳይመረጥ እንዲቀር)
                card.marked[key] = false; 
                saveAllData();
                renderActiveGamePage();
                return;
            }
        }
    }
    
    // **3. ሁሉም ፍተሻዎች ካለፉ**
    
    // **አዲስ ማሻሻያ:** Claim ተደርጓል ብሎ ምልክት መስጠት (ቁጥር መጥራቱ እንዲቆም)
    BINGO_PAUSED_FOR_CLAIM = 'CLAIMED'; 
    
    // የጃክፖት ስሌት
    const totalCardsTaken = Object.keys(BINGO_SELECTED_CARD_OWNERS).length;
    const totalRevenue = totalCardsTaken * BINGO_TICKET_PRICE; 
    const JACKPOT_PERCENTAGE = 0.85; 
    const jackpotAmount = (totalRevenue * JACKPOT_PERCENTAGE); 
    
    alert(`የቢንጎ ጥያቄ (ካርድ #${cardId}) ተልኳል! ${jackpotAmount.toFixed(2)} ETB ሽልማት የማግኘት ዕድል አለ:: አድሚን እስኪያረጋግጥ ድረስ ይጠብቁ::`);
    
    // (በእውነተኛው አድሚን ነው የሚፀድቀው - ለናሙና ጊዜያዊ ሎጂክ)
    setTimeout(() => {
        
        const isApproved = confirm(`አድሚን: የካርድ #${cardId} ቢንጎ መኖሩን ያረጋግጣሉ?`);
        
        if (isApproved) {
            // ሽልማቱን መስጠት
            currentUser.balance += jackpotAmount;
            currentBalance = currentUser.balance; 
            
            alert(`🎉 እንኳን ደስ አለዎት! የቢንጎ ሽልማት ${jackpotAmount.toFixed(2)} ETB ወደ ሂሳብዎ ገብቷል። ጨዋታው አብቅቷል::`);
            
            // ጨዋታውን ማቆም እና ወደ መጀመሪያ ሁኔታ መመለስ
            clearInterval(BINGO_NUMBERS_CALL_INTERVAL); 
            BINGO_GAME_RUNNING = false;
            BINGO_LAST_CALLED_NUMBER = "END";
            BINGO_LAST_CALLED_DISPLAY = "WIN";
            BINGO_PAUSED_FOR_CLAIM = false;
            
            // የጨዋታ ዳታዎችን ማጽዳት ለቀጣዩ ዙር (ተጠቃሚው አዲስ ካርድ መግዛት አለበት)
            BINGO_NUMBERS_CALLED = [];
            BINGO_USER_CARDS = [];
            BINGO_SELECTED_CARD_OWNERS = {};
            BINGO_CARD_SELECTION_PHASE = true; // የካርድ መምረጫ ይጀምራል
            BINGO_TIMER_SECONDS = 30;
            
            saveAllData(); // ዳታ ማስቀመጥ

            renderNavbar();
            window.location.hash = '#account-page'; // ወደ መለያ ገጽ መውሰድ
            
        } else {
            // ውድቅ ከተደረገ
            BINGO_PAUSED_FOR_CLAIM = false;
            saveAllData(); // ዳታ ማስቀመጥ
            alert("የቢንጎ ጥያቄዎ ውድቅ ተደርጓል። ጨዋታው ይቀጥላል::");
            if (window.location.hash === '#bingo-game-page') {
                renderActiveGamePage(); 
            }
        }
    }, 5000); // አምስት ሰከንድ ቆይታ
}


/**
 * የቢንጎ ጨዋታ ገጽን ይፈጥራል
 */
function renderActiveGamePage() { // isPausedForClaim parameter removed
    if (!isLoggedIn || BINGO_USER_CARDS.length === 0) {
        // ካርድ የሌለው ሰው ወደ መምረጫው ይመለሳል
        window.location.hash = '#bingo-game-page';
        renderBingoPage(); 
        return;
    }
    
    // የተጠሩ ቁጥሮችን በፊደል መሰረት ማደራጀት
    const calledNumbersByLetter = { 'B': [], 'I': [], 'N': [], 'G': [], 'O': [] };
    BINGO_NUMBERS_CALLED.forEach(num => {
        const letter = getLetterForNumber(num);
        if (calledNumbersByLetter[letter]) {
            calledNumbersByLetter[letter].push(num);
        }
    });

    // ለፊደል ማሳያ HTML መፍጠር
    const calledNumbersHtml = ['B', 'I', 'N', 'G', 'O'].map(letter => {
        // ቁጥሮቹ በቅደም ተከተል ይደረደራሉ
        const numbers = calledNumbersByLetter[letter].sort((a, b) => a - b); 
        
        // የተጠሩ ቁጥሮችን በB-I-N-G-O ስር ማሳየት (እንደ ስዕሉ)
        const numbersHtml = numbers.map(num => `
            <span style="display: inline-block; padding: 2px 5px; margin: 2px; background-color: #f7b731; border-radius: 3px; font-weight: bold; font-size: 0.9em; border: 1px solid #cc0000;">
                ${num}
            </span>
        `).join('');

        return `
            <div style="flex-basis: 19%; text-align: center; padding: 5px; border-right: 1px solid #ccc; background-color: #f0f0f0;">
                <h4 style="margin: 0; padding-bottom: 5px; color: #004a99; font-size: 1.2em;">${letter}</h4>
                <div style="max-height: 250px; overflow-y: auto; background-color: #fff; padding: 5px; border-radius: 4px; border: 1px solid #eee;">
                    ${numbersHtml}
                </div>
            </div>
        `;
    }).join('');

    // የመጨረሻ የተጠራ ቁጥር ማሳያ ማሻሻያ
    let lastCalledDisplay = '';

    if (BINGO_PAUSED_FOR_CLAIM === 'CLAIMED') {
         lastCalledDisplay = `
            <span style="font-size: 1.5em; font-weight: bold; color: white; background-color: #004a99; padding: 15px 30px; border-radius: 10px; box-shadow: 0 0 15px rgba(0,74,153,0.5);">
                <i class="fas fa-gavel"></i> የቢንጎ ጥያቄ ቀርቧል!
            </span>
            <p style="color: white; margin-top: 10px;">የጨዋታው ውጤት በመጠባበቅ ላይ ነው::</p>
        `;
    } else if (BINGO_LAST_CALLED_DISPLAY !== null && BINGO_LAST_CALLED_DISPLAY !== "END" && BINGO_LAST_CALLED_DISPLAY !== "WIN") {
        // መደበኛ ቁጥር ጥሪ (የpause ጊዜን ጨምሮ የመጨረሻውን ቁጥር ያሳያል)
        lastCalledDisplay = `
            <span style="font-size: 3em; font-weight: bold; color: white; background-color: #cc0000; padding: 15px 30px; border-radius: 10px; box-shadow: 0 0 15px rgba(255,0,0,0.5);">
                ${BINGO_LAST_CALLED_DISPLAY}
            </span>
        `;
    } 
    else {
        // ጨዋታው ሲያልቅ ወይም ሲጀምር
        lastCalledDisplay = `<span style="font-size: 1.5em; color: ${BINGO_LAST_CALLED_DISPLAY === "WIN" ? "#008000" : "#cc0000"}; font-weight: bold;">${BINGO_LAST_CALLED_DISPLAY === "END" ? "ጨዋታው ተጠናቋል" : (BINGO_LAST_CALLED_DISPLAY === "WIN" ? "ሽልማት ተሰጥቷል!" : "ቁጥር በመጠበቅ ላይ...")}</span>`;
    }

    const userCardsHtml = BINGO_USER_CARDS.map(card => renderUserCardForGame(card)).join('');
    
    // የደርሻ ስሌት
    const totalCardsTaken = Object.keys(BINGO_SELECTED_CARD_OWNERS).length;
    const totalRevenue = totalCardsTaken * BINGO_TICKET_PRICE; 
    const JACKPOT_PERCENTAGE = 0.85; 
    const jackpotAmount = (totalRevenue * JACKPOT_PERCENTAGE).toFixed(2); 

    const totalCardsDisplay = `
        <div style="text-align: center; margin-bottom: 15px; padding: 10px; border: 2px solid #008000; border-radius: 8px; background-color: #e8f5e9; display: flex; justify-content: space-around; align-items: center;">
            <div style="flex: 1; border-right: 1px solid #ccc; padding: 5px;">
                <p style="margin: 0; font-size: 1.2em; font-weight: bold; color: #004a99;">
                    <i class="fas fa-ticket-alt"></i> የተያዙ ካርዶች ብዛት: 
                    <span style="font-size: 1.5em; color: #cc0000; margin-left: 5px;">${totalCardsTaken}</span>
                </p>
            </div>
            <div style="flex: 1; padding: 5px;">
                <p style="margin: 0; font-size: 1.2em; font-weight: bold; color: #004a99;">
                    <i class="fas fa-trophy"></i> ደርሻ: 
                    <span style="font-size: 1.5em; color: #008000; margin-left: 5px;">ETB ${jackpotAmount}</span>
                </p>
            </div>
        </div>
    `;

    appContainer.innerHTML = `
        <div class="page-container" style="max-width: 1200px; padding: 10px;">
            <h2><i class="fas fa-bullhorn"></i> ቀጥታ የቢንጎ ጨዋታ! - ቁጥሮችን ራስዎ ምልክት ያድርጉ</h2>
            
            ${totalCardsDisplay}
            
            <div style="display: flex; flex-wrap: wrap; justify-content: center; align-items: flex-start;">
            
                <div style="flex-basis: 40%; min-width: 300px; margin-right: 20px;">
                    <h3>የእርስዎ የተገዙ ካርዶች:</h3>
                    <p style="color: #004a99; font-weight: bold;">እባክዎ የተጠሩትን ቁጥሮች በካርዱ ላይ በመንካት ምልክት ያድርጉ::</p>
                    <div style="display: flex; flex-direction: column; align-items: center; border: 1px solid #ddd; padding: 10px; border-radius: 8px; background-color: #f9f9f9;">
                        ${userCardsHtml}
                    </div>
                </div>
                
                <div style="flex-basis: 55%; min-width: 400px; padding: 10px; border: 1px solid #004a99; border-radius: 8px; background-color: #e6f0ff;">
                
                    <div style="text-align: center; margin-bottom: 20px; padding: 15px; background-color: #004a99; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.3);">
                        <h3 style="color: white; margin-bottom: 10px;">አሁን የተጠራው ቁጥር:</h3>
                        ${lastCalledDisplay}
                    </div>
                
                    <div style="padding: 10px; border: 2px solid #ddd; border-radius: 8px; background-color: #fff;">
                        <h4 style="margin-top: 0; color: #333; text-align: center; border-bottom: 1px solid #ccc; padding-bottom: 5px;">የተጠሩ ቁጥሮች በቅደም ተከተል:</h4>
                        <div style="display: flex; justify-content: space-around; border: 1px solid #ccc; border-radius: 6px; overflow: hidden;">
                            ${calledNumbersHtml}
                        </div>
                    </div>
                    
                </div>
                
            </div>
            
        </div>
    `;
}

// ----------------------------------------------------
// 8. የአሰሳ ተግባር (Routing/Navigation) 
// ----------------------------------------------------

function handleNavigation() {
    const hash = window.location.hash || '#register-page';
    
    if (isLoggedIn && currentUser) {
        currentBalance = currentUser.balance;
    }
    
    renderNavbar(); // ቆጣሪውን በNavbar ላይ እንዲያሳይ
    
    // የጨዋታ ገጽ አስተዳደር
    if (hash === '#bingo-game-page') {
        if (!isLoggedIn) {
             renderLoginPage();
             return;
        }
        
        // የካርድ መምረጫው ሰዓት ካለፈ እና ካርድ ከገዛ ወደ አክቲቭ ጨዋታ ገጽ ይወሰዳል
        if (!BINGO_CARD_SELECTION_PHASE && BINGO_USER_CARDS.length > 0) {
            renderActiveGamePage();
            return;
        } 
        
        // ካርድ ካልገዛ ወይም የካርድ መምረጫው ክፍት ከሆነ
        renderBingoPage();
        return;
    }

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
    } else {
        // ወደ መነሻ ገጽ (ምዝገባ) ይመልሳል
        renderRegisterPage();
    }
}

// ----------------------------------------------------
// 9. የመተግበሪያ ማስጀመሪያ (Initialization) - ዳታ መጫን!
// ----------------------------------------------------

loadAllData(); // ከመጀመሪያው አሰሳ በፊት መረጃውን ይጭናል!

window.addEventListener('load', () => {
    startContinuousTimer(); // አፕሊኬሽኑ እንደተከፈተ ቆጣሪውን ወዲያውኑ ይጀምራል
    handleNavigation(); 
});
window.addEventListener('hashchange', handleNavigation);