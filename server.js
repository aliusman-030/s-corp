require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const session = require('express-session');
const multer = require('multer');

// ... rest of your code

app.use(session({
    secret: process.env.SESSION_SECRET || 's-corp-secret-key-2024',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// ===== PLAN CONFIGURATION (3 PLANS) =====
const PLANS = {
    'Plan 1': {
        price: 500,
        dailyVideos: 1,
        videoCommission: 30,
        withdrawalLimit: 250,
        referralCommission: 50
    },
    'Plan 2': {
        price: 1000,
        dailyVideos: 3,
        videoCommission: 40,
        withdrawalLimit: 500,
        referralCommission: 80
    },
    'Plan 3': {
        price: 1500,
        dailyVideos: 5,
        videoCommission: 50,
        withdrawalLimit: 750,
        referralCommission: 100
    }
};

// ===== FILE PATHS =====
const DATA_DIR = path.join(__dirname, 'Data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const VIDEOS_FILE = path.join(DATA_DIR, 'videoAccess.json');
const PAYMENT_METHODS_FILE = path.join(DATA_DIR, 'paymentMethods.json');
const COMPANY_BALANCE_FILE = path.join(DATA_DIR, 'companyBalance.json');
const UPLOADS_DIR = path.join(__dirname, 'Uploads');

// ===== PERMANENT ADMIN =====
const ADMIN_EMAIL = 'admin@site.com';
const ADMIN_PASSWORD = 'Admin@123';

// ===== MULTER SETUP =====
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(UPLOADS_DIR)) {
            fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        }
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + '-' + file.originalname;
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage: storage, 
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Only image and document files are allowed for payment proof'));
        }
    }
});

// ===== INITIALIZE =====
async function initialize() {
    console.log('Initializing S-CORP Server...');
    
    [DATA_DIR, UPLOADS_DIR].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`✓ Created ${path.basename(dir)}/`);
        }
    });

    let users = [];
    if (fs.existsSync(USERS_FILE)) {
        try {
            users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
            console.log(`✓ Loaded ${users.length} existing users`);
        } catch (e) {
            users = [];
        }
    }

    const adminExists = users.some(u => u.email === ADMIN_EMAIL);
    if (!adminExists) {
        const hashedAdminPass = await bcrypt.hash(ADMIN_PASSWORD, 10);
        users.push({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            hashedPassword: hashedAdminPass,
            plan: 'Plan 1',
            watched: [],
            watchedKeys: [],
            referral: 'ADMIN-REF',
            amount: 0,
            withdrawalRequested: false,
            withdrawalMessage: '',
            grantedVideos: true,
            videoAccessGrantedAt: new Date().toISOString(),
            uploads: [],
            role: 'admin',
            withdrawalMethod: 'Easypaisa',
            withdrawalAccount: '03000000000',
            accountHolderName: 'Admin Account',
            accountTitle: 'Admin Account Title',
            createdAt: new Date().toISOString(),
            totalReferralsAdded: 0,
            referralsWithPlan: 0,
            referralsWithoutPlan: 0,
            dailyVideosWatched: 0,
            referralEarnings: 0,
            videoEarnings: 0,
            referredBy: '',
            lastDailyReset: new Date().toISOString(),
            isPaid: true,
            paidAmount: 500
        });
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        console.log('✓ Created permanent admin account');
    }

    if (!fs.existsSync(COMPANY_BALANCE_FILE)) {
        const defaultCompanyBalance = {
            totalCollected: 0,
            totalPaid: 0,
            totalCommissionPaid: 0,
            balance: 0,
            transactions: []
        };
        fs.writeFileSync(COMPANY_BALANCE_FILE, JSON.stringify(defaultCompanyBalance, null, 2));
        console.log('✓ Created company balance file');
    }

    if (!fs.existsSync(PAYMENT_METHODS_FILE)) {
        const defaultPaymentMethods = {
            methods: [
                { name: "Easypaisa", number: "03484252348", type: "deposit" },
                { name: "JazzCash", number: "03059170455", type: "deposit" }
            ]
        };
        fs.writeFileSync(PAYMENT_METHODS_FILE, JSON.stringify(defaultPaymentMethods, null, 2));
        console.log('✓ Created payment methods file');
    }

    if (!fs.existsSync(VIDEOS_FILE)) {
        const defaultVideos = {
            v1: "https://www.youtube.com/embed/dQw4w9WgXcQ",
            v2: "https://www.youtube.com/embed/3JZ_D3ELwOQ",
            v3: "https://www.youtube.com/embed/kJQP7kiw5Fk",
            v4: "https://www.youtube.com/embed/9bZkp7q19f0",
            v5: "https://www.youtube.com/embed/tgbNymZ7vqY"
        };
        fs.writeFileSync(VIDEOS_FILE, JSON.stringify(defaultVideos, null, 2));
        console.log('✓ Created videos file');
    }
    
    console.log('✓ Server initialization complete!');
}

function readJSON(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        return null;
    }
}

function writeJSON(file, data) {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
        return true;
    } catch (e) {
        console.error(`Error writing ${file}:`, e);
        return false;
    }
}

function checkAndResetDailyCounters(user) {
    const now = new Date();
    const lastReset = user.lastDailyReset ? new Date(user.lastDailyReset) : new Date(0);
    
    const resetDate = new Date(lastReset);
    resetDate.setHours(0, 0, 0, 0);
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    if (resetDate.getTime() < today.getTime()) {
        user.dailyVideosWatched = 0;
        user.watched = [];
        user.watchedKeys = [];
        user.lastDailyReset = now.toISOString();
        return true;
    }
    return false;
}

function updateCompanyBalance(amount, type, description) {
    try {
        const company = readJSON(COMPANY_BALANCE_FILE) || {
            totalCollected: 0,
            totalPaid: 0,
            totalCommissionPaid: 0,
            balance: 0,
            transactions: []
        };
        
        if (type === 'collected') {
            company.totalCollected += amount;
            company.balance += amount;
        } else if (type === 'paid') {
            company.totalPaid += amount;
            company.balance -= amount;
        } else if (type === 'commission') {
            company.totalCommissionPaid += amount;
            company.balance -= amount;
        }
        
        company.transactions.push({
            amount,
            type,
            description,
            timestamp: new Date().toISOString()
        });
        
        writeJSON(COMPANY_BALANCE_FILE, company);
        return true;
    } catch (e) {
        console.error('Error updating company balance:', e);
        return false;
    }
}

// Process referral commission when child gets video access
async function processReferralCommission(childEmail, planName) {
    let users = readJSON(USERS_FILE) || [];
    const childIndex = users.findIndex(u => u.email === childEmail);
    
    if (childIndex === -1) return false;
    
    const child = users[childIndex];
    const referredBy = child.referredBy;
    
    // Check if child was referred by someone
    if (!referredBy) return false;
    
    const parentIndex = users.findIndex(u => u.email === referredBy);
    if (parentIndex === -1) return false;
    
    const parent = users[parentIndex];
    const planData = PLANS[planName];
    
    if (!planData) return false;
    
    // Check if parent has a plan (must have purchased a plan to receive commission)
    if (!parent.plan || parent.plan === '') {
        console.log(`Parent ${referredBy} has no plan, cannot receive commission`);
        return false;
    }
    
    const commission = planData.referralCommission;
    const currentParentBalance = parseFloat(parent.amount) || 0;
    
    // Add commission to parent's balance
    users[parentIndex].amount = (currentParentBalance + commission).toFixed(2);
    users[parentIndex].referralEarnings = (parent.referralEarnings || 0) + commission;
    users[parentIndex].referralsWithPlan = (parent.referralsWithPlan || 0) + 1;
    
    // Deduct commission from company balance
    updateCompanyBalance(commission, 'commission', `Referral commission paid to ${referredBy} for referring ${childEmail} (${planName})`);
    
    writeJSON(USERS_FILE, users);
    
    console.log(`💰 Referral Commission: ${referredBy} earned ${commission} PKR for referring ${childEmail} (${planName})`);
    return true;
}

initialize();

function requireLogin(req, res, next) {
    if (!req.session.user) {
        if (req.xhr || req.headers.accept?.includes('json')) {
            return res.status(401).json({ success: false, message: 'Please login first' });
        }
        return res.redirect('/login.html');
    }
    next();
}

function requireAdmin(req, res, next) {
    if (req.session.user !== ADMIN_EMAIL) {
        if (req.xhr || req.headers.accept?.includes('json')) {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }
        return res.redirect('/login.html');
    }
    next();
}

// ===== ROUTES =====
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'Public', 'index.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'Public', 'login.html')));
app.get('/signup.html', (req, res) => res.sendFile(path.join(__dirname, 'Public', 'signup.html')));
app.get('/home.html', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'Public', 'home.html')));
app.get('/profile.html', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'Public', 'profile.html')));
app.get('/admin.html', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'Public', 'admin.html')));
app.get('/videos.html', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'Public', 'videos.html')));

// SIGNUP
app.post('/signup', async (req, res) => {
    try {
        const { email, password, confirmPassword, referralCode } = req.body;
        
        if (!email || !password || !confirmPassword) {
            return res.json({ success: false, message: 'All fields are required' });
        }
        
        if (password !== confirmPassword) {
            return res.json({ success: false, message: 'Passwords do not match' });
        }
        
        if (email === ADMIN_EMAIL) {
            return res.json({ success: false, message: 'Admin email reserved' });
        }

        let users = readJSON(USERS_FILE) || [];
        if (users.find(u => u.email === email)) {
            return res.json({ success: false, message: 'Email already exists' });
        }

        const hashed = await bcrypt.hash(password, 10);
        const referral = `${email.split('@')[0]}-${Date.now().toString().slice(-6)}`;
        
        let referredBy = '';
        let parentUser = null;
        
        if (referralCode) {
            parentUser = users.find(u => u.referral === referralCode);
            if (parentUser) {
                referredBy = parentUser.email;
                // Update parent's total referrals count (without plan yet)
                const parentIndex = users.findIndex(u => u.email === parentUser.email);
                if (parentIndex !== -1) {
                    users[parentIndex].totalReferralsAdded = (users[parentIndex].totalReferralsAdded || 0) + 1;
                    users[parentIndex].referralsWithoutPlan = (users[parentIndex].referralsWithoutPlan || 0) + 1;
                    writeJSON(USERS_FILE, users);
                }
            }
        }
        
        const newUser = {
            email, 
            password: password,
            hashedPassword: hashed,
            plan: '', 
            watched: [],
            watchedKeys: [],
            referral,
            amount: 0,
            withdrawalRequested: false,
            withdrawalMessage: '',
            grantedVideos: false,
            videoAccessGrantedAt: null,
            uploads: [], 
            role: 'user',
            withdrawalMethod: '', 
            withdrawalAccount: '', 
            accountHolderName: '',
            accountTitle: '',
            createdAt: new Date().toISOString(),
            totalReferralsAdded: 0,
            referralsWithPlan: 0,
            referralsWithoutPlan: 0,
            dailyVideosWatched: 0,
            referralEarnings: 0,
            videoEarnings: 0,
            referredBy: referredBy,
            lastDailyReset: new Date().toISOString(),
            isPaid: false,
            paidAmount: 0
        };
        
        users.push(newUser);
        writeJSON(USERS_FILE, users);
        
        res.json({ success: true, message: 'Account created successfully!', referral: referral });
    } catch (e) {
        console.error('Signup error:', e);
        res.json({ success: false, message: 'Server error during signup' });
    }
});

// LOGIN
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.json({ success: false, message: 'Email and password required' });
        }
        
        const users = readJSON(USERS_FILE) || [];
        const user = users.find(u => u.email === email);
        
        if (!user) return res.json({ success: false, message: 'User not found' });
        
        const match = await bcrypt.compare(password, user.hashedPassword || user.password);
        if (!match) return res.json({ success: false, message: 'Incorrect password' });
        
        req.session.user = email;
        req.session.isAdmin = email === ADMIN_EMAIL;
        
        res.json({ success: true, message: 'Login successful!', isAdmin: email === ADMIN_EMAIL });
    } catch (e) {
        console.error('Login error:', e);
        res.json({ success: false, message: 'Server error during login' });
    }
});

// LOGOUT
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login.html');
});

// PROFILE DATA
app.get('/profileData', requireLogin, (req, res) => {
    const users = readJSON(USERS_FILE) || [];
    const user = users.find(u => u.email === req.session.user);
    
    if (!user) {
        req.session.destroy();
        return res.status(404).json({ message: 'User not found' });
    }
    
    checkAndResetDailyCounters(user);
    
    const allVideos = readJSON(VIDEOS_FILE) || {};
    const planData = user.plan ? PLANS[user.plan] : null;
    
    let grantedVideos = [];
    
    if (user.grantedVideos === true && planData) {
        const videoKeys = Object.keys(allVideos);
        const videoCount = Math.min(planData.dailyVideos, videoKeys.length);
        const assignedKeys = videoKeys.slice(0, videoCount);
        
        grantedVideos = assignedKeys.map(key => ({
            key: key,
            url: allVideos[key],
            isWatched: (user.watchedKeys && user.watchedKeys.includes(key)) || false
        })).filter(v => v.url && v.url.trim() !== '');
    }
    
    const response = {
        email: user.email,
        plan: user.plan || '',
        referral: user.referral || '',
        amount: parseFloat(user.amount || 0).toFixed(2),
        withdrawalLimit: planData ? planData.withdrawalLimit : 0,
        videos: grantedVideos,
        isAdmin: req.session.user === ADMIN_EMAIL,
        uploads: user.uploads || [],
        totalReferralsAdded: user.totalReferralsAdded || 0,
        referralsWithPlan: user.referralsWithPlan || 0,
        referralsWithoutPlan: user.referralsWithoutPlan || 0,
        dailyVideosWatched: user.dailyVideosWatched || 0,
        dailyVideoLimit: planData ? planData.dailyVideos : 0,
        planPrice: planData ? planData.price : 0,
        withdrawalRequested: user.withdrawalRequested || false,
        withdrawalMessage: user.withdrawalMessage || '',
        withdrawalMethod: user.withdrawalMethod || '',
        withdrawalAccount: user.withdrawalAccount || '',
        accountHolderName: user.accountHolderName || '',
        accountTitle: user.accountTitle || '',
        videoEarnings: user.videoEarnings || 0,
        referralEarnings: user.referralEarnings || 0,
        referredBy: user.referredBy || '',
        createdAt: user.createdAt || new Date().toISOString(),
        isPaid: user.isPaid || false,
        grantedVideos: user.grantedVideos || false,
        videoCommission: planData ? planData.videoCommission : 0,
        watchedKeys: user.watchedKeys || []
    };
    
    writeJSON(USERS_FILE, users);
    res.json(response);
});

// GET DEPOSIT METHODS
app.get('/getDepositMethods', (req, res) => {
    try {
        const methods = readJSON(PAYMENT_METHODS_FILE) || { methods: [] };
        res.json(methods.methods);
    } catch (e) {
        res.json([]);
    }
});

// SAVE DEPOSIT METHODS
app.post('/saveDepositMethods', requireAdmin, (req, res) => {
    const { methods } = req.body;
    
    if (!Array.isArray(methods)) {
        return res.json({ success: false, message: 'Invalid data format' });
    }
    
    const methodsWithType = methods.map(method => ({
        ...method,
        type: 'deposit'
    }));
    
    const paymentMethods = { methods: methodsWithType };
    writeJSON(PAYMENT_METHODS_FILE, paymentMethods);
    
    res.json({ success: true, message: `Updated ${methods.length} deposit methods` });
});

// GET COMPANY BALANCE
app.get('/getCompanyBalance', requireAdmin, (req, res) => {
    try {
        const company = readJSON(COMPANY_BALANCE_FILE) || {
            totalCollected: 0,
            totalPaid: 0,
            totalCommissionPaid: 0,
            balance: 0
        };
        
        res.json({
            totalCollected: company.totalCollected || 0,
            totalPaid: company.totalPaid || 0,
            totalCommissionPaid: company.totalCommissionPaid || 0,
            balance: company.balance || 0
        });
    } catch (e) {
        res.json({ totalCollected: 0, totalPaid: 0, totalCommissionPaid: 0, balance: 0 });
    }
});

// GET USERS - With referral details
app.get('/getUsers', requireAdmin, (req, res) => {
    const users = readJSON(USERS_FILE) || [];
    
    const usersWithStats = users.map(user => {
        const planData = user.plan ? PLANS[user.plan] : null;
        
        return {
            email: user.email,
            plan: user.plan || '',
            amount: parseFloat(user.amount || 0).toFixed(2),
            withdrawalLimit: planData ? planData.withdrawalLimit : 0,
            totalReferralsAdded: user.totalReferralsAdded || 0,
            referralsWithPlan: user.referralsWithPlan || 0,
            referralsWithoutPlan: user.referralsWithoutPlan || 0,
            referralEarnings: user.referralEarnings || 0,
            uploads: user.uploads || [],
            grantedVideos: user.grantedVideos || false,
            isPaid: user.isPaid || false,
            withdrawalRequested: user.withdrawalRequested || false,
            withdrawalMessage: user.withdrawalMessage || '',
            withdrawalMethod: user.withdrawalMethod || '',
            withdrawalAccount: user.withdrawalAccount || '',
            accountHolderName: user.accountHolderName || '',
            accountTitle: user.accountTitle || '',
            role: user.role || 'user',
            createdAt: user.createdAt,
            watchedKeys: user.watchedKeys || [],
            referredBy: user.referredBy || ''
        };
    });
    
    res.json(usersWithStats);
});

// GET VIDEOS
app.get('/getVideos', (req, res) => {
    res.json(readJSON(VIDEOS_FILE) || {});
});

// SAVE VIDEOS
app.post('/saveVideos', requireAdmin, (req, res) => {
    writeJSON(VIDEOS_FILE, req.body);
    console.log('✅ Videos saved');
    res.json({ success: true, message: 'Videos saved!' });
});

// SELECT PLAN
app.post('/selectPlan', requireLogin, (req, res) => {
    const { plan } = req.body;
    
    if (!plan || !PLANS[plan]) {
        return res.json({ success: false, message: 'Invalid plan selected' });
    }
    
    let users = readJSON(USERS_FILE) || [];
    const userIndex = users.findIndex(u => u.email === req.session.user);
    
    if (userIndex === -1) return res.json({ success: false, message: 'User not found' });
    
    users[userIndex].plan = plan;
    users[userIndex].grantedVideos = false;
    users[userIndex].isPaid = false;
    
    writeJSON(USERS_FILE, users);
    
    res.json({ 
        success: true, 
        message: `Plan updated to ${plan}! Please deposit ${PLANS[plan].price} PKR and upload payment proof.`,
        planPrice: PLANS[plan].price
    });
});

// UPLOAD PAYMENT PROOF
app.post('/upload', requireLogin, upload.single('media'), (req, res) => {
    try {
        if (!req.file) {
            return res.json({ success: false, message: 'No file uploaded' });
        }
        
        let users = readJSON(USERS_FILE) || [];
        const userIndex = users.findIndex(u => u.email === req.session.user);
        
        if (userIndex === -1) return res.json({ success: false, message: 'User not found' });
        
        const fileInfo = {
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype,
            uploadedAt: new Date().toISOString(),
            description: req.body.description || 'Payment proof',
            downloadUrl: `/uploads/${req.file.filename}`,
            type: 'payment_proof'
        };
        
        if (!users[userIndex].uploads) {
            users[userIndex].uploads = [];
        }
        
        users[userIndex].uploads.push(fileInfo);
        writeJSON(USERS_FILE, users);
        
        res.json({ success: true, message: 'Payment proof uploaded! Waiting for admin approval.' });
        
    } catch (error) {
        console.error('Upload error:', error);
        res.json({ success: false, message: error.message || 'Error uploading file' });
    }
});

// TOGGLE VIDEO ACCESS - This triggers referral commission!
app.post('/toggleVideoAccess', requireAdmin, async (req, res) => {
    const { email, grantAccess } = req.body;
    
    if (!email) return res.json({ success: false, message: 'Email required' });
    
    let users = readJSON(USERS_FILE) || [];
    const userIndex = users.findIndex(u => u.email === email);
    
    if (userIndex === -1) return res.json({ success: false, message: 'User not found' });
    
    const user = users[userIndex];
    const planData = PLANS[user.plan];
    
    if (!planData && grantAccess) {
        return res.json({ success: false, message: 'User has no plan selected. Cannot grant access.' });
    }
    
    // Store the plan name before potentially changing anything
    const userPlan = user.plan;
    
    // Toggle access
    users[userIndex].grantedVideos = grantAccess === true;
    users[userIndex].isPaid = grantAccess === true;
    
    if (grantAccess) {
        users[userIndex].videoAccessGrantedAt = new Date().toISOString();
        users[userIndex].paidAmount = planData ? planData.price : 0;
        
        // Add to company collected balance
        updateCompanyBalance(planData.price, 'collected', `Payment from ${email} for ${user.plan}`);
        
        // IMPORTANT: Process referral commission for the parent user
        // This runs AFTER child gets video access
        await processReferralCommission(email, userPlan);
        
        console.log(`✅ GRANTED video access to ${email} for plan ${user.plan}`);
    } else {
        users[userIndex].videoAccessGrantedAt = null;
        console.log(`❌ REVOKED video access from ${email}`);
    }
    
    writeJSON(USERS_FILE, users);
    
    res.json({ 
        success: true, 
        message: grantAccess ? `Video access GRANTED to ${email}${user.referredBy ? ' - Referral commission processed!' : ''}` : `Video access REVOKED from ${email}`,
        grantedVideos: grantAccess
    });
});

// PROCESS WITHDRAWAL (PAID BUTTON)
app.post('/processWithdrawal', requireAdmin, (req, res) => {
    const { email } = req.body;
    
    if (!email) return res.json({ success: false, message: 'Email required' });
    
    let users = readJSON(USERS_FILE) || [];
    const userIndex = users.findIndex(u => u.email === email);
    
    if (userIndex === -1) return res.json({ success: false, message: 'User not found' });
    
    const user = users[userIndex];
    const planData = PLANS[user.plan];
    
    if (!planData) {
        return res.json({ success: false, message: 'User has no plan' });
    }
    
    if (!user.withdrawalRequested) {
        return res.json({ success: false, message: 'No pending withdrawal request' });
    }
    
    const withdrawalAmount = planData.withdrawalLimit;
    const currentUserBalance = parseFloat(user.amount) || 0;
    
    if (currentUserBalance < withdrawalAmount) {
        return res.json({ success: false, message: `Insufficient balance: ${currentUserBalance} < ${withdrawalAmount}` });
    }
    
    // Deduct from user balance
    const newUserBalance = currentUserBalance - withdrawalAmount;
    users[userIndex].amount = newUserBalance.toFixed(2);
    users[userIndex].withdrawalRequested = false;
    users[userIndex].withdrawalMessage = `PAID - ${withdrawalAmount} PKR paid on ${new Date().toLocaleString()}`;
    
    // Deduct from company balance
    updateCompanyBalance(withdrawalAmount, 'paid', `Withdrawal paid to ${email}`);
    
    writeJSON(USERS_FILE, users);
    
    console.log(`💰 Withdrawal processed: ${email} | Amount: ${withdrawalAmount} PKR | New balance: ${newUserBalance.toFixed(2)}`);
    
    res.json({ 
        success: true, 
        message: `Withdrawal of ${withdrawalAmount} PKR processed for ${email}`,
        newBalance: newUserBalance.toFixed(2)
    });
});

// MARK VIDEO AS WATCHED
app.post('/markVideoWatched', requireLogin, (req, res) => {
    const { videoKey, videoUrl } = req.body;
    
    let users = readJSON(USERS_FILE) || [];
    const userIndex = users.findIndex(u => u.email === req.session.user);
    
    if (userIndex === -1) return res.json({ success: false, message: 'User not found' });
    
    const user = users[userIndex];
    
    checkAndResetDailyCounters(user);
    
    if (!user.plan || user.plan === '') {
        return res.json({ success: false, message: 'Please select a plan first' });
    }
    
    if (user.grantedVideos !== true) {
        return res.json({ success: false, message: 'Video access not granted yet.' });
    }
    
    const planData = PLANS[user.plan];
    if (!planData) {
        return res.json({ success: false, message: 'Invalid plan' });
    }
    
    if (user.dailyVideosWatched >= planData.dailyVideos) {
        return res.json({ success: false, message: `Daily limit reached (${planData.dailyVideos}/${planData.dailyVideos})` });
    }
    
    if (!user.watchedKeys) user.watchedKeys = [];
    
    if (user.watchedKeys.includes(videoKey)) {
        return res.json({ success: false, message: `This video already watched today! Come back tomorrow.` });
    }
    
    user.watchedKeys.push(videoKey);
    user.dailyVideosWatched = (user.dailyVideosWatched || 0) + 1;
    
    const earnings = planData.videoCommission;
    const currentAmount = parseFloat(user.amount) || 0;
    user.amount = (currentAmount + earnings).toFixed(2);
    user.videoEarnings = (user.videoEarnings || 0) + earnings;
    
    writeJSON(USERS_FILE, users);
    
    res.json({ 
        success: true, 
        message: `🎉 +${earnings} PKR earned!`,
        earnings: earnings,
        dailyVideosWatched: user.dailyVideosWatched,
        dailyVideoLimit: planData.dailyVideos,
        amount: user.amount
    });
});

// REQUEST WITHDRAWAL
app.post('/requestWithdrawal', requireLogin, (req, res) => {
    let users = readJSON(USERS_FILE) || [];
    const userIndex = users.findIndex(u => u.email === req.session.user);
    
    if (userIndex === -1) return res.json({ success: false, message: 'User not found' });
    
    const user = users[userIndex];
    
    if (!user.withdrawalMethod || !user.withdrawalAccount || !user.accountHolderName) {
        return res.json({ success: false, message: 'Please save your withdrawal information first!' });
    }
    
    if (!user.plan || user.plan === '') {
        return res.json({ success: false, message: 'Please select a plan first' });
    }
    
    const planData = PLANS[user.plan];
    const withdrawalLimit = planData.withdrawalLimit;
    const currentAmount = parseFloat(user.amount) || 0;
    
    if (currentAmount < withdrawalLimit) {
        return res.json({ success: false, message: `Need ${withdrawalLimit} PKR to withdraw. Current: ${currentAmount.toFixed(2)} PKR` });
    }
    
    if (user.withdrawalRequested) {
        return res.json({ success: false, message: 'You already have a pending withdrawal request' });
    }
    
    user.withdrawalRequested = true;
    user.withdrawalMessage = `PENDING - ${withdrawalLimit} PKR requested on ${new Date().toLocaleString()}`;
    
    writeJSON(USERS_FILE, users);
    
    res.json({ success: true, message: 'Withdrawal requested! Admin will process it soon.' });
});

// SAVE WITHDRAWAL INFO
app.post('/saveWithdrawalInfo', requireLogin, (req, res) => {
    const { withdrawalMethod, withdrawalAccount, accountHolderName, accountTitle } = req.body;
    
    if (!withdrawalMethod || !withdrawalMethod.trim()) {
        return res.json({ success: false, message: 'Please select a withdrawal method' });
    }
    
    if (!withdrawalAccount || withdrawalAccount.trim().length < 10) {
        return res.json({ success: false, message: 'Please enter a valid account number (min 10 digits)' });
    }
    
    if (!accountHolderName || !accountHolderName.trim()) {
        return res.json({ success: false, message: 'Please enter account holder name' });
    }
    
    let users = readJSON(USERS_FILE) || [];
    const userIndex = users.findIndex(u => u.email === req.session.user);
    
    if (userIndex === -1) return res.json({ success: false, message: 'User not found' });
    
    users[userIndex].withdrawalMethod = withdrawalMethod;
    users[userIndex].withdrawalAccount = withdrawalAccount;
    users[userIndex].accountHolderName = accountHolderName;
    users[userIndex].accountTitle = accountTitle || '';
    
    writeJSON(USERS_FILE, users);
    
    res.json({ success: true, message: 'Withdrawal information saved successfully!' });
});

// DELETE USER - Admin only
app.post('/deleteUser', requireAdmin, (req, res) => {
    const { email } = req.body;
    
    if (!email) return res.json({ success: false, message: 'Email required' });
    
    let users = readJSON(USERS_FILE) || [];
    
    if (email === ADMIN_EMAIL) {
        return res.json({ success: false, message: 'Cannot delete admin account' });
    }
    
    users = users.filter(u => u.email !== email);
    writeJSON(USERS_FILE, users);
    
    console.log(`🗑️ Admin deleted user: ${email}`);
    
    res.json({ success: true, message: `User ${email} deleted successfully` });
});

// RESET DAILY COUNTERS
app.post('/resetDailyCounters', requireAdmin, (req, res) => {
    let users = readJSON(USERS_FILE) || [];
    const now = new Date().toISOString();
    let resetCount = 0;
    
    users.forEach(user => {
        if (user.email !== ADMIN_EMAIL) {
            user.dailyVideosWatched = 0;
            user.watched = [];
            user.watchedKeys = [];
            user.lastDailyReset = now;
            resetCount++;
        }
    });
    
    writeJSON(USERS_FILE, users);
    console.log(`🔄 Admin reset daily counters for ${resetCount} users`);
    res.json({ success: true, message: `Daily counters reset for ${resetCount} users` });
});

// RESET COMPANY BALANCE
app.post('/resetCompanyBalance', requireAdmin, (req, res) => {
    try {
        const defaultCompanyBalance = {
            totalCollected: 0,
            totalPaid: 0,
            totalCommissionPaid: 0,
            balance: 0,
            transactions: []
        };
        writeJSON(COMPANY_BALANCE_FILE, defaultCompanyBalance);
        console.log('🏦 Company balance reset to 0 by admin');
        res.json({ success: true, message: 'Company balance reset to 0' });
    } catch (e) {
        res.json({ success: false, message: 'Error resetting balance' });
    }
});

// START SERVER
app.listen(PORT, () => {
    console.log(`✅ S-CORP server running on http://localhost:${PORT}`);
    console.log(`💰 Currency: PKR`);
    console.log(`📊 Plans: 500, 1000, 1500 PKR`);
    console.log(`🎬 Video Commission: 30/40/50 PKR per video`);
    console.log(`👥 Referral Commission: 50/80/100 PKR (paid when child gets video access)`);
    console.log(`🔐 Admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
});