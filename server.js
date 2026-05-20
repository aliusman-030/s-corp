require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const session = require('express-session');
const multer = require('multer');
const { MongoClient } = require('mongodb');
const MongoStore = require('connect-mongo');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== MONGODB CONNECTION =====
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://s-corp-user:S-Corp2026@cluster0.rjxsj7i.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const DB_NAME = 's-corp';

// ===== MIDDLEWARE =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'Public')));
app.use('/uploads', express.static(path.join(__dirname, 'Uploads')));

app.use(session({
    secret: process.env.SESSION_SECRET || 's-corp-super-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: MONGODB_URI, dbName: DB_NAME, collectionName: 'sessions', ttl: 24 * 60 * 60 }),
    cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

// ===== PLAN CONFIGURATION =====
const PLANS = {
    'Plan 1': { price: 500, dailyVideos: 1, videoCommission: 30, withdrawalLimit: 250, referralCommission: 50 },
    'Plan 2': { price: 1000, dailyVideos: 3, videoCommission: 40, withdrawalLimit: 500, referralCommission: 80 },
    'Plan 3': { price: 1500, dailyVideos: 5, videoCommission: 50, withdrawalLimit: 750, referralCommission: 100 }
};

let db;
let usersCollection;
let videosCollection;
let paymentMethodsCollection;
let companyBalanceCollection;
let luckyDrawCollection;

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@site.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Abac@123';

// ===== MULTER SETUP =====
const UPLOADS_DIR = path.join(__dirname, 'Uploads');
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage, 
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) cb(null, true);
        else cb(new Error('Only image and document files are allowed'));
    }
});

// ===== CONNECT TO MONGODB =====
async function connectDB() {
    try {
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        db = client.db(DB_NAME);
        usersCollection = db.collection('users');
        videosCollection = db.collection('videos');
        paymentMethodsCollection = db.collection('paymentmethods');
        companyBalanceCollection = db.collection('companybalance');
        luckyDrawCollection = db.collection('luckydraw');
        
        console.log('✅ Connected to MongoDB');
        await initializeDB();
        return true;
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        return false;
    }
}

async function initializeDB() {
    try {
        const adminExists = await usersCollection.findOne({ email: ADMIN_EMAIL });
        if (!adminExists) {
            const hashedAdminPass = await bcrypt.hash(ADMIN_PASSWORD, 10);
            await usersCollection.insertOne({
                email: ADMIN_EMAIL, password: ADMIN_PASSWORD, hashedPassword: hashedAdminPass,
                plan: 'Plan 1', watched: [], watchedKeys: [], referral: 'ADMIN-REF', amount: 0,
                withdrawalRequested: false, withdrawalMessage: '', grantedVideos: true,
                videoAccessGrantedAt: new Date().toISOString(), uploads: [], role: 'admin',
                withdrawalMethod: 'Easypaisa', withdrawalAccount: '03000000000',
                accountHolderName: 'Admin Account', accountTitle: 'Admin Account Title',
                createdAt: new Date().toISOString(), totalReferralsAdded: 0, referralsWithPlan: 0,
                referralsWithoutPlan: 0, dailyVideosWatched: 0, referralEarnings: 0, videoEarnings: 0,
                referredBy: '', lastDailyReset: new Date().toISOString(), isPaid: true, paidAmount: 500,
                luckyDraw: { selectedNumber: null, lastResetDate: null }, luckyDrawWins: [],
                coinBalance: 0, coinTransactions: []
            });
            console.log('✓ Created admin account');
        }
        
        const videosExist = await videosCollection.findOne({ _id: 'videos' });
        if (!videosExist) {
            await videosCollection.insertOne({
                _id: 'videos',
                v1: "https://www.youtube.com/embed/dQw4w9WgXcQ",
                v2: "https://www.youtube.com/embed/3JZ_D3ELwOQ",
                v3: "https://www.youtube.com/embed/kJQP7kiw5Fk",
                v4: "https://www.youtube.com/embed/9bZkp7q19f0",
                v5: "https://www.youtube.com/embed/tgbNymZ7vqY"
            });
            console.log('✓ Created default videos');
        }
        
        const paymentMethodsExist = await paymentMethodsCollection.findOne({ _id: 'methods' });
        if (!paymentMethodsExist) {
            await paymentMethodsCollection.insertOne({
                _id: 'methods',
                methods: [
                    { name: "Easypaisa", number: "03484252348", type: "deposit" },
                    { name: "JazzCash", number: "03059170455", type: "deposit" }
                ]
            });
            console.log('✓ Created payment methods');
        }
        
        const companyBalanceExist = await companyBalanceCollection.findOne({ _id: 'balance' });
        if (!companyBalanceExist) {
            await companyBalanceCollection.insertOne({
                _id: 'balance', totalCollected: 0, totalPaid: 0, totalCommissionPaid: 0, balance: 0, transactions: []
            });
            console.log('✓ Created company balance');
        }
        
        const coinSettingsExist = await db.collection('coinsettings').findOne({ _id: 'settings' });
        if (!coinSettingsExist) {
            await db.collection('coinsettings').insertOne({
                _id: 'settings', currentPrice: 10, lastUpdated: new Date().toISOString()
            });
            console.log('✓ Created coin settings');
        }
    } catch (error) {
        console.error('Error initializing DB:', error);
    }
}

async function checkAndResetDailyCounters(user) {
    const now = new Date();
    const lastReset = user.lastDailyReset ? new Date(user.lastDailyReset) : new Date(0);
    const resetDate = new Date(lastReset);
    resetDate.setHours(0, 0, 0, 0);
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    if (resetDate.getTime() < today.getTime()) {
        await usersCollection.updateOne(
            { email: user.email },
            { $set: { dailyVideosWatched: 0, watched: [], watchedKeys: [], lastDailyReset: now.toISOString() } }
        );
        return true;
    }
    return false;
}

async function updateCompanyBalance(amount, type, description) {
    const company = await companyBalanceCollection.findOne({ _id: 'balance' }) || {
        totalCollected: 0, totalPaid: 0, totalCommissionPaid: 0, balance: 0, transactions: []
    };
    if (type === 'collected') { company.totalCollected += amount; company.balance += amount; }
    else if (type === 'paid') { company.totalPaid += amount; company.balance -= amount; }
    else if (type === 'commission') { company.totalCommissionPaid += amount; company.balance -= amount; }
    company.transactions.push({ amount, type, description, timestamp: new Date().toISOString() });
    await companyBalanceCollection.updateOne({ _id: 'balance' }, { $set: company }, { upsert: true });
    return true;
}

// ===== REFERRAL FUNCTIONS =====
async function processReferralOnPlanSelection(childEmail, planName) {
    const child = await usersCollection.findOne({ email: childEmail });
    if (!child) return false;
    const referredBy = child.referredBy;
    if (!referredBy || referredBy === '') return false;
    const hadPlanBefore = child.plan && child.plan !== '';
    if (hadPlanBefore) return false;
    const parent = await usersCollection.findOne({ email: referredBy });
    if (!parent) return false;
    await usersCollection.updateOne(
        { email: referredBy },
        { $inc: { totalReferralsAdded: 1, referralsWithoutPlan: 1 } }
    );
    return true;
}

async function processReferralCommission(childEmail, planName) {
    const child = await usersCollection.findOne({ email: childEmail });
    if (!child) return false;
    const referredBy = child.referredBy;
    if (!referredBy || referredBy === '') return false;
    const parent = await usersCollection.findOne({ email: referredBy });
    if (!parent) return false;
    const planData = PLANS[planName];
    if (!planData) return false;
    if (!parent.plan || parent.plan === '') return false;
    const commission = planData.referralCommission;
    const currentParentBalance = parseFloat(parent.amount) || 0;
    const newBalance = currentParentBalance + commission;
    await usersCollection.updateOne(
        { email: referredBy },
        { $set: { amount: newBalance, referralEarnings: (parent.referralEarnings || 0) + commission } }
    );
    await usersCollection.updateOne(
        { email: referredBy },
        { $inc: { referralsWithPlan: 1, referralsWithoutPlan: -1 } }
    );
    await updateCompanyBalance(commission, 'commission', `Referral commission paid to ${referredBy} for referring ${childEmail} (${planName})`);
    return true;
}

function getTodayPKT() {
    const now = new Date();
    const pktDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
    return pktDate.toISOString().split('T')[0];
}

function getTomorrowPKT() {
    const today = getTodayPKT();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
}

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

        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
            return res.json({ success: false, message: 'Email already exists' });
        }

        const hashed = await bcrypt.hash(password, 10);
        const referral = `${email.split('@')[0]}-${Date.now().toString().slice(-6)}`;
        
        let referredBy = '';
        if (referralCode && referralCode !== '') {
            const referringUser = await usersCollection.findOne({ referral: referralCode });
            if (referringUser) {
                referredBy = referringUser.email;
            }
        }
        
        const newUser = {
            email, password, hashedPassword: hashed, plan: '', watched: [], watchedKeys: [], referral,
            amount: 0, withdrawalRequested: false, withdrawalMessage: '', grantedVideos: false,
            videoAccessGrantedAt: null, uploads: [], role: 'user', withdrawalMethod: '', withdrawalAccount: '',
            accountHolderName: '', accountTitle: '', createdAt: new Date().toISOString(),
            totalReferralsAdded: 0, referralsWithPlan: 0, referralsWithoutPlan: 0, dailyVideosWatched: 0,
            referralEarnings: 0, videoEarnings: 0, referredBy: referredBy, lastDailyReset: new Date().toISOString(),
            isPaid: false, paidAmount: 0, luckyDraw: { selectedNumber: null, lastResetDate: null }, luckyDrawWins: [],
            coinBalance: 0, coinTransactions: []
        };
        
        await usersCollection.insertOne(newUser);
        
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
        const user = await usersCollection.findOne({ email });
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

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login.html');
});

// PROFILE DATA
app.get('/profileData', requireLogin, async (req, res) => {
    try {
        let user = await usersCollection.findOne({ email: req.session.user });
        if (!user) return res.status(404).json({ message: 'User not found' });
        await checkAndResetDailyCounters(user);
        user = await usersCollection.findOne({ email: req.session.user });
        const videosDoc = await videosCollection.findOne({ _id: 'videos' });
        const allVideos = videosDoc || {};
        const planData = user.plan ? PLANS[user.plan] : null;
        let grantedVideos = [];
        if (user.grantedVideos === true && planData) {
            const videoKeys = ['v1', 'v2', 'v3', 'v4', 'v5'].filter(key => allVideos[key]);
            const videoCount = Math.min(planData.dailyVideos, videoKeys.length);
            const assignedKeys = videoKeys.slice(0, videoCount);
            grantedVideos = assignedKeys.map(key => ({ key, url: allVideos[key], isWatched: (user.watchedKeys || []).includes(key) })).filter(v => v.url && v.url.trim());
        }
        
        const coinSettings = await db.collection('coinsettings').findOne({ _id: 'settings' });
        const coinPrice = coinSettings?.currentPrice || 10;
        
        res.json({
            email: user.email, plan: user.plan || '', referral: user.referral || '',
            amount: (parseFloat(user.amount) || 0).toFixed(2), withdrawalLimit: planData ? planData.withdrawalLimit : 0,
            videos: grantedVideos, isAdmin: req.session.user === ADMIN_EMAIL, uploads: user.uploads || [],
            totalReferralsAdded: user.totalReferralsAdded || 0, referralsWithPlan: user.referralsWithPlan || 0,
            referralsWithoutPlan: user.referralsWithoutPlan || 0, dailyVideosWatched: user.dailyVideosWatched || 0,
            dailyVideoLimit: planData ? planData.dailyVideos : 0, planPrice: planData ? planData.price : 0,
            withdrawalRequested: user.withdrawalRequested || false, withdrawalMessage: user.withdrawalMessage || '',
            withdrawalMethod: user.withdrawalMethod || '', withdrawalAccount: user.withdrawalAccount || '',
            accountHolderName: user.accountHolderName || '', accountTitle: user.accountTitle || '',
            videoEarnings: user.videoEarnings || 0, referralEarnings: user.referralEarnings || 0,
            referredBy: user.referredBy || '', createdAt: user.createdAt || new Date().toISOString(),
            isPaid: user.isPaid || false, grantedVideos: user.grantedVideos || false,
            videoCommission: planData ? planData.videoCommission : 0, watchedKeys: user.watchedKeys || [],
            coinBalance: user.coinBalance || 0, coinPrice: coinPrice, coinTransactions: user.coinTransactions || []
        });
    } catch (e) { res.status(500).json({ message: 'Server error' }); }
});

// GET DEPOSIT METHODS
app.get('/getDepositMethods', async (req, res) => {
    try {
        const methodsDoc = await paymentMethodsCollection.findOne({ _id: 'methods' });
        res.json(methodsDoc?.methods || []);
    } catch (e) { res.json([]); }
});

app.post('/saveDepositMethods', requireAdmin, async (req, res) => {
    const { methods } = req.body;
    if (!Array.isArray(methods)) return res.json({ success: false, message: 'Invalid data format' });
    await paymentMethodsCollection.updateOne({ _id: 'methods' }, { $set: { methods: methods.map(m => ({ ...m, type: 'deposit' })) } }, { upsert: true });
    res.json({ success: true, message: `Updated ${methods.length} deposit methods` });
});

app.get('/getCompanyBalance', requireAdmin, async (req, res) => {
    try {
        const company = await companyBalanceCollection.findOne({ _id: 'balance' }) || { totalCollected: 0, totalPaid: 0, totalCommissionPaid: 0, balance: 0 };
        res.json(company);
    } catch (e) { res.json({ totalCollected: 0, totalPaid: 0, totalCommissionPaid: 0, balance: 0 }); }
});

app.get('/getUsers', requireAdmin, async (req, res) => {
    try {
        const users = await usersCollection.find({}).toArray();
        res.json(users.map(user => ({
            email: user.email, plan: user.plan || '', amount: (parseFloat(user.amount) || 0).toFixed(2),
            withdrawalLimit: user.plan ? PLANS[user.plan]?.withdrawalLimit : 0,
            totalReferralsAdded: user.totalReferralsAdded || 0, referralsWithPlan: user.referralsWithPlan || 0,
            referralsWithoutPlan: user.referralsWithoutPlan || 0, referralEarnings: user.referralEarnings || 0,
            uploads: user.uploads || [], grantedVideos: user.grantedVideos || false, isPaid: user.isPaid || false,
            withdrawalRequested: user.withdrawalRequested || false, withdrawalMessage: user.withdrawalMessage || '',
            withdrawalMethod: user.withdrawalMethod || '', withdrawalAccount: user.withdrawalAccount || '',
            accountHolderName: user.accountHolderName || '', accountTitle: user.accountTitle || '',
            role: user.role || 'user', createdAt: user.createdAt, referredBy: user.referredBy || '',
            coinBalance: user.coinBalance || 0
        })));
    } catch (e) { res.json([]); }
});

app.get('/getVideos', async (req, res) => {
    try {
        const videosDoc = await videosCollection.findOne({ _id: 'videos' });
        const { _id, ...videos } = videosDoc || {};
        res.json(videos);
    } catch (e) { res.json({}); }
});

app.post('/saveVideos', requireAdmin, async (req, res) => {
    try {
        await videosCollection.updateOne({ _id: 'videos' }, { $set: req.body }, { upsert: true });
        res.json({ success: true, message: 'Videos saved!' });
    } catch (e) { res.json({ success: false, message: 'Error saving videos' }); }
});

// SELECT PLAN
app.post('/selectPlan', requireLogin, async (req, res) => {
    const { plan } = req.body;
    const userEmail = req.session.user;
    
    if (!plan || !PLANS[plan]) {
        return res.json({ success: false, message: 'Invalid plan selected' });
    }
    
    try {
        const user = await usersCollection.findOne({ email: userEmail });
        if (!user) return res.json({ success: false, message: 'User not found' });
        
        const hadPlanBefore = user.plan && user.plan !== '';
        const hasReferrer = user.referredBy && user.referredBy !== '';
        
        await usersCollection.updateOne(
            { email: userEmail },
            { $set: { plan: plan, grantedVideos: false, isPaid: false } }
        );
        
        if (hasReferrer && !hadPlanBefore) {
            await processReferralOnPlanSelection(userEmail, plan);
        }
        
        res.json({ 
            success: true, 
            message: `Plan updated to ${plan}! Please deposit ${PLANS[plan].price} PKR and upload payment proof.`,
            planPrice: PLANS[plan].price
        });
    } catch (error) {
        console.error('Plan selection error:', error);
        res.json({ success: false, message: 'Server error' });
    }
});

app.post('/upload', requireLogin, upload.single('media'), async (req, res) => {
    try {
        if (!req.file) return res.json({ success: false, message: 'No file uploaded' });
        const user = await usersCollection.findOne({ email: req.session.user });
        if (!user) return res.json({ success: false, message: 'User not found' });
        const uploads = user.uploads || [];
        uploads.push({
            filename: req.file.filename, originalName: req.file.originalname, size: req.file.size,
            mimetype: req.file.mimetype, uploadedAt: new Date().toISOString(),
            description: req.body.description || 'Payment proof', downloadUrl: `/uploads/${req.file.filename}`,
            type: 'payment_proof'
        });
        await usersCollection.updateOne({ email: req.session.user }, { $set: { uploads } });
        res.json({ success: true, message: 'Payment proof uploaded! Waiting for admin approval.' });
    } catch (error) {
        res.json({ success: false, message: error.message || 'Error uploading file' });
    }
});

// TOGGLE VIDEO ACCESS
app.post('/toggleVideoAccess', requireAdmin, async (req, res) => {
    const { email, grantAccess } = req.body;
    
    try {
        const user = await usersCollection.findOne({ email });
        if (!user) return res.json({ success: false, message: 'User not found' });
        
        const planData = PLANS[user.plan];
        if (!planData && grantAccess) {
            return res.json({ success: false, message: 'User has no plan selected. Cannot grant access.' });
        }
        
        const wasGranted = user.grantedVideos;
        
        await usersCollection.updateOne(
            { email },
            { $set: { grantedVideos: grantAccess === true, isPaid: grantAccess === true, videoAccessGrantedAt: grantAccess ? new Date().toISOString() : null } }
        );
        
        if (grantAccess && !wasGranted) {
            await updateCompanyBalance(planData.price, 'collected', `Payment from ${email} for ${user.plan}`);
            await processReferralCommission(email, user.plan);
        }
        
        res.json({ success: true, message: grantAccess ? `Video access GRANTED to ${email}` : `Video access REVOKED from ${email}` });
    } catch (error) {
        console.error('Toggle error:', error);
        res.json({ success: false, message: 'Server error' });
    }
});

app.post('/processWithdrawal', requireAdmin, async (req, res) => {
    const { email } = req.body;
    try {
        const user = await usersCollection.findOne({ email });
        if (!user) return res.json({ success: false, message: 'User not found' });
        const planData = PLANS[user.plan];
        if (!planData) return res.json({ success: false, message: 'User has no plan' });
        if (!user.withdrawalRequested) return res.json({ success: false, message: 'No pending withdrawal request' });
        const withdrawalAmount = planData.withdrawalLimit;
        const currentBalance = parseFloat(user.amount) || 0;
        if (currentBalance < withdrawalAmount) return res.json({ success: false, message: 'Insufficient balance' });
        const newBalance = currentBalance - withdrawalAmount;
        await usersCollection.updateOne({ email }, { $set: { amount: newBalance, withdrawalRequested: false, withdrawalMessage: `PAID - ${withdrawalAmount} PKR paid on ${new Date().toLocaleString()}` } });
        await updateCompanyBalance(withdrawalAmount, 'paid', `Withdrawal paid to ${email}`);
        res.json({ success: true, message: `Withdrawal of ${withdrawalAmount} PKR processed` });
    } catch (error) { res.json({ success: false, message: 'Server error' }); }
});

app.post('/markVideoWatched', requireLogin, async (req, res) => {
    const { videoKey } = req.body;
    const userEmail = req.session.user;
    try {
        let user = await usersCollection.findOne({ email: userEmail });
        if (!user) return res.json({ success: false, message: 'User not found' });
        await checkAndResetDailyCounters(user);
        user = await usersCollection.findOne({ email: userEmail });
        if (!user.plan) return res.json({ success: false, message: 'Please select a plan first' });
        if (user.grantedVideos !== true) return res.json({ success: false, message: 'Video access not granted yet' });
        const planData = PLANS[user.plan];
        if (user.dailyVideosWatched >= planData.dailyVideos) return res.json({ success: false, message: 'Daily limit reached' });
        if ((user.watchedKeys || []).includes(videoKey)) return res.json({ success: false, message: 'Already watched today' });
        const watchedKeys = user.watchedKeys || [];
        watchedKeys.push(videoKey);
        const earnings = planData.videoCommission;
        const newAmount = (parseFloat(user.amount) || 0) + earnings;
        await usersCollection.updateOne({ email: userEmail }, { $set: { watchedKeys, dailyVideosWatched: (user.dailyVideosWatched || 0) + 1, amount: newAmount, videoEarnings: (user.videoEarnings || 0) + earnings } });
        res.json({ success: true, message: `🎉 +${earnings} PKR earned!`, earnings });
    } catch (error) { res.json({ success: false, message: 'Server error' }); }
});

app.post('/requestWithdrawal', requireLogin, async (req, res) => {
    try {
        const user = await usersCollection.findOne({ email: req.session.user });
        if (!user) return res.json({ success: false, message: 'User not found' });
        if (!user.withdrawalMethod || !user.withdrawalAccount) return res.json({ success: false, message: 'Please save withdrawal information first' });
        if (!user.plan) return res.json({ success: false, message: 'Please select a plan first' });
        const planData = PLANS[user.plan];
        const withdrawalLimit = planData.withdrawalLimit;
        const currentAmount = parseFloat(user.amount) || 0;
        if (currentAmount < withdrawalLimit) return res.json({ success: false, message: `Need ${withdrawalLimit} PKR to withdraw` });
        if (user.withdrawalRequested) return res.json({ success: false, message: 'Already have a pending request' });
        await usersCollection.updateOne({ email: req.session.user }, { $set: { withdrawalRequested: true, withdrawalMessage: `PENDING - ${withdrawalLimit} PKR requested` } });
        res.json({ success: true, message: 'Withdrawal requested!' });
    } catch (error) { res.json({ success: false, message: 'Server error' }); }
});

app.post('/saveWithdrawalInfo', requireLogin, async (req, res) => {
    const { withdrawalMethod, withdrawalAccount, accountHolderName, accountTitle } = req.body;
    if (!withdrawalMethod || !withdrawalAccount || withdrawalAccount.length < 10 || !accountHolderName) {
        return res.json({ success: false, message: 'Please fill all fields' });
    }
    try {
        await usersCollection.updateOne({ email: req.session.user }, { $set: { withdrawalMethod, withdrawalAccount, accountHolderName, accountTitle: accountTitle || '' } });
        res.json({ success: true, message: 'Withdrawal information saved!' });
    } catch (error) { res.json({ success: false, message: 'Server error' }); }
});

app.post('/deleteUser', requireAdmin, async (req, res) => {
    const { email } = req.body;
    if (email === ADMIN_EMAIL) return res.json({ success: false, message: 'Cannot delete admin' });
    await usersCollection.deleteOne({ email });
    res.json({ success: true, message: 'User deleted' });
});

app.post('/resetDailyCounters', requireAdmin, async (req, res) => {
    const now = new Date().toISOString();
    const result = await usersCollection.updateMany({ email: { $ne: ADMIN_EMAIL } }, { $set: { dailyVideosWatched: 0, watched: [], watchedKeys: [], lastDailyReset: now } });
    res.json({ success: true, message: `Reset for ${result.modifiedCount} users` });
});

app.post('/resetCompanyBalance', requireAdmin, async (req, res) => {
    await companyBalanceCollection.updateOne({ _id: 'balance' }, { $set: { totalCollected: 0, totalPaid: 0, totalCommissionPaid: 0, balance: 0, transactions: [] } }, { upsert: true });
    res.json({ success: true, message: 'Company balance reset' });
});

app.get('/force-create-admin', async (req, res) => {
    try {
        const hashedAdminPass = await bcrypt.hash(ADMIN_PASSWORD, 10);
        await usersCollection.updateOne({ email: ADMIN_EMAIL }, {
            $set: {
                email: ADMIN_EMAIL, password: ADMIN_PASSWORD, hashedPassword: hashedAdminPass,
                plan: 'Plan 1', watched: [], watchedKeys: [], referral: 'ADMIN-REF', amount: 0,
                withdrawalRequested: false, withdrawalMessage: '', grantedVideos: true,
                videoAccessGrantedAt: new Date().toISOString(), uploads: [], role: 'admin',
                withdrawalMethod: 'Easypaisa', withdrawalAccount: '03000000000', accountHolderName: 'Admin Account',
                accountTitle: 'Admin Account Title', createdAt: new Date().toISOString(), totalReferralsAdded: 0,
                referralsWithPlan: 0, referralsWithoutPlan: 0, dailyVideosWatched: 0, referralEarnings: 0,
                videoEarnings: 0, referredBy: '', lastDailyReset: new Date().toISOString(), isPaid: true, paidAmount: 500,
                luckyDraw: { selectedNumber: null, lastResetDate: null }, luckyDrawWins: [],
                coinBalance: 0, coinTransactions: []
            }
        }, { upsert: true });
        res.json({ success: true, message: 'Admin created/updated' });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// ===== LUCKY DRAW API =====

app.get('/getLuckyDrawStatus', requireLogin, async (req, res) => {
    try {
        const user = await usersCollection.findOne({ email: req.session.user });
        const today = getTodayPKT();
        const tomorrow = getTomorrowPKT();
        
        const todayDraw = await luckyDrawCollection.findOne({ date: today });
        const winningNumber = todayDraw?.winningNumber || null;
        const rewardAmount = todayDraw?.rewardAmount || null;
        const isAnnounced = todayDraw?.isAnnounced || false;
        
        let canSelect = false;
        let userSelectedNumber = null;
        
        const hasValidPlan = (user.plan && user.plan !== '') || user.grantedVideos === true;
        
        if (hasValidPlan) {
            canSelect = true;
        }
        
        if (user.luckyDraw && user.luckyDraw.lastResetDate === tomorrow && user.luckyDraw.selectedNumber) {
            canSelect = false;
            userSelectedNumber = user.luckyDraw.selectedNumber;
        }
        
        const wins = user.luckyDrawWins || [];
        
        res.json({
            success: true,
            winningNumber: winningNumber,
            rewardAmount: rewardAmount,
            isAnnounced: isAnnounced,
            canSelect: canSelect,
            userSelectedNumber: userSelectedNumber,
            nextDrawTime: "Tomorrow 12:00 AM",
            wins: wins.slice(-5),
            hasPlan: hasValidPlan
        });
    } catch (error) {
        console.error('Lucky draw error:', error);
        res.json({ success: false, message: error.message });
    }
});

app.post('/selectLuckyNumber', requireLogin, async (req, res) => {
    const { number } = req.body;
    const userEmail = req.session.user;
    
    if (!number || number < 1 || number > 12) {
        return res.json({ success: false, message: 'Please select a number between 1 and 12' });
    }
    
    try {
        const tomorrow = getTomorrowPKT();
        const user = await usersCollection.findOne({ email: userEmail });
        
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }
        
        const hasValidPlan = (user.plan && user.plan !== '') || user.grantedVideos === true;
        
        if (!hasValidPlan) {
            return res.json({ success: false, message: 'You need to have a plan to participate in Lucky Draw!' });
        }
        
        if (user.luckyDraw && user.luckyDraw.lastResetDate === tomorrow && user.luckyDraw.selectedNumber) {
            return res.json({ success: false, message: `You have already selected a number for the next draw!` });
        }
        
        await usersCollection.updateOne(
            { email: userEmail },
            { 
                $set: { 
                    luckyDraw: { 
                        selectedNumber: number, 
                        selectedAt: new Date().toISOString(), 
                        lastResetDate: tomorrow 
                    } 
                } 
            }
        );
        
        res.json({ success: true, message: `You selected number ${number} for the next lucky draw! Good luck!` });
    } catch (error) {
        console.error('Select number error:', error);
        res.json({ success: false, message: 'Error saving your selection' });
    }
});

app.post('/setWinningNumber', requireAdmin, async (req, res) => {
    const { winningNumber, rewardAmount } = req.body;
    
    if (!winningNumber || winningNumber < 1 || winningNumber > 12) {
        return res.json({ success: false, message: 'Please select a valid winning number (1-12)' });
    }
    
    if (!rewardAmount || rewardAmount < 50 || rewardAmount > 5000) {
        return res.json({ success: false, message: 'Reward amount must be between 50 and 5000 PKR' });
    }
    
    try {
        const today = getTodayPKT();
        
        const existingDraw = await luckyDrawCollection.findOne({ date: today });
        if (existingDraw && existingDraw.isAnnounced) {
            return res.json({ success: false, message: 'Winning number already announced for today!' });
        }
        
        await luckyDrawCollection.updateOne(
            { date: today },
            { 
                $set: { 
                    winningNumber: winningNumber,
                    rewardAmount: rewardAmount,
                    isAnnounced: true,
                    announcedAt: new Date().toISOString()
                }
            },
            { upsert: true }
        );
        
        const winners = await usersCollection.find({ 
            "luckyDraw.selectedNumber": winningNumber, 
            "luckyDraw.lastResetDate": today 
        }).toArray();
        
        let winnerCount = 0;
        
        for (const winner of winners) {
            const newBalance = (parseFloat(winner.amount) || 0) + rewardAmount;
            await usersCollection.updateOne(
                { email: winner.email },
                { 
                    $set: { amount: newBalance },
                    $push: { luckyDrawWins: { 
                        date: today, 
                        number: winningNumber, 
                        reward: rewardAmount, 
                        awardedAt: new Date().toISOString() 
                    } }
                }
            );
            winnerCount++;
        }
        
        res.json({ 
            success: true, 
            message: `Winning number ${winningNumber} announced! ${winnerCount} users won ${rewardAmount} PKR each!`,
            winnerCount: winnerCount
        });
    } catch (error) {
        console.error('Set winning number error:', error);
        res.json({ success: false, message: 'Error setting winning number' });
    }
});

app.get('/getLuckyDrawSelections', requireAdmin, async (req, res) => {
    try {
        const today = getTodayPKT();
        const tomorrow = getTomorrowPKT();
        
        const todayDraw = await luckyDrawCollection.findOne({ date: today });
        const winningNumber = todayDraw?.winningNumber || null;
        const rewardAmount = todayDraw?.rewardAmount || null;
        
        const selections = [];
        const users = await usersCollection.find({ "luckyDraw.lastResetDate": tomorrow }).toArray();
        
        for (const user of users) {
            if (user.luckyDraw && user.luckyDraw.selectedNumber) {
                selections.push({
                    email: user.email,
                    selectedNumber: user.luckyDraw.selectedNumber,
                    selectedDate: user.luckyDraw.lastResetDate
                });
            }
        }
        
        res.json({
            success: true,
            winningNumber: winningNumber,
            rewardAmount: rewardAmount,
            isAnnounced: todayDraw?.isAnnounced || false,
            selections: selections
        });
    } catch (error) {
        console.error('Get selections error:', error);
        res.json({ success: false, selections: [] });
    }
});

app.post('/forceLuckyDrawReset', requireAdmin, async (req, res) => {
    try {
        await usersCollection.updateMany(
            {},
            { $set: { "luckyDraw.selectedNumber": null, "luckyDraw.selectedAt": null } }
        );
        res.json({ success: true, message: 'Lucky draw reset completed' });
    } catch (error) {
        res.json({ success: false, message: 'Error resetting' });
    }
});

// ===== S-COIN SYSTEM =====

app.get('/getCoinSettings', async (req, res) => {
    try {
        const settings = await db.collection('coinsettings').findOne({ _id: 'settings' });
        res.json({ success: true, currentPrice: settings?.currentPrice || 10 });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

app.post('/setCoinPrice', requireAdmin, async (req, res) => {
    const { price } = req.body;
    
    if (!price || price < 1) {
        return res.json({ success: false, message: 'Price must be at least 1 PKR' });
    }
    
    try {
        await db.collection('coinsettings').updateOne(
            { _id: 'settings' },
            { $set: { currentPrice: price, lastUpdated: new Date().toISOString() } },
            { upsert: true }
        );
        res.json({ success: true, message: `Coin price set to ${price} PKR` });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

app.post('/requestBuyCoins', requireLogin, upload.single('media'), async (req, res) => {
    const { coins } = req.body;
    const userEmail = req.session.user;
    
    if (!coins || coins < 1 || coins > 1000) {
        return res.json({ success: false, message: 'Please enter coins between 1 and 1000' });
    }
    
    if (!req.file) {
        return res.json({ success: false, message: 'Please upload payment proof' });
    }
    
    try {
        const settings = await db.collection('coinsettings').findOne({ _id: 'settings' });
        const price = settings?.currentPrice || 10;
        const totalAmount = coins * price;
        
        const user = await usersCollection.findOne({ email: userEmail });
        const uploads = user.uploads || [];
        
        const fileInfo = {
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype,
            uploadedAt: new Date().toISOString(),
            description: `Buy ${coins} S-Coins at ${price} PKR each = ${totalAmount} PKR`,
            downloadUrl: `/uploads/${req.file.filename}`,
            type: 'coin_purchase'
        };
        
        uploads.push(fileInfo);
        
        const transaction = {
            id: Date.now().toString(),
            type: 'buy_request',
            coins: parseInt(coins),
            price: price,
            amount: totalAmount,
            status: 'pending',
            proofUrl: fileInfo.downloadUrl,
            requestedAt: new Date().toISOString(),
            approvedAt: null
        };
        
        const coinTransactions = user.coinTransactions || [];
        coinTransactions.push(transaction);
        
        await usersCollection.updateOne(
            { email: userEmail },
            { $set: { uploads: uploads, coinTransactions: coinTransactions } }
        );
        
        res.json({ success: true, message: `Buy request for ${coins} S-Coins submitted! Waiting for admin approval.` });
    } catch (error) {
        console.error('Buy coins error:', error);
        res.json({ success: false, message: 'Error submitting request' });
    }
});

app.post('/requestSellCoins', requireLogin, async (req, res) => {
    const { coins } = req.body;
    const userEmail = req.session.user;
    
    if (!coins || coins < 1) {
        return res.json({ success: false, message: 'Please enter valid number of coins' });
    }
    
    try {
        const user = await usersCollection.findOne({ email: userEmail });
        const currentBalance = user.coinBalance || 0;
        
        if (coins > currentBalance) {
            return res.json({ success: false, message: `You only have ${currentBalance} S-Coins` });
        }
        
        const settings = await db.collection('coinsettings').findOne({ _id: 'settings' });
        const price = settings?.currentPrice || 10;
        const totalAmount = coins * price;
        
        if (!user.withdrawalMethod || !user.withdrawalAccount) {
            return res.json({ success: false, message: 'Please save your withdrawal information first in Profile' });
        }
        
        const transaction = {
            id: Date.now().toString(),
            type: 'sell_request',
            coins: parseInt(coins),
            price: price,
            amount: totalAmount,
            status: 'pending',
            requestedAt: new Date().toISOString(),
            approvedAt: null,
            withdrawalMethod: user.withdrawalMethod,
            withdrawalAccount: user.withdrawalAccount,
            accountHolderName: user.accountHolderName
        };
        
        const coinTransactions = user.coinTransactions || [];
        coinTransactions.push(transaction);
        
        await usersCollection.updateOne(
            { email: userEmail },
            { $set: { coinTransactions: coinTransactions } }
        );
        
        res.json({ success: true, message: `Sell request for ${coins} S-Coins submitted! Admin will process within 24 hours.` });
    } catch (error) {
        console.error('Sell coins error:', error);
        res.json({ success: false, message: 'Error submitting request' });
    }
});

app.post('/approveCoinPurchase', requireAdmin, async (req, res) => {
    const { email, transactionId, approve } = req.body;
    
    if (!email || !transactionId) {
        return res.json({ success: false, message: 'Missing information' });
    }
    
    try {
        const user = await usersCollection.findOne({ email });
        if (!user) return res.json({ success: false, message: 'User not found' });
        
        const transactions = user.coinTransactions || [];
        const transactionIndex = transactions.findIndex(t => t.id === transactionId);
        
        if (transactionIndex === -1) {
            return res.json({ success: false, message: 'Transaction not found' });
        }
        
        if (approve) {
            const transaction = transactions[transactionIndex];
            const newBalance = (user.coinBalance || 0) + transaction.coins;
            
            transactions[transactionIndex].status = 'approved';
            transactions[transactionIndex].approvedAt = new Date().toISOString();
            
            await usersCollection.updateOne(
                { email },
                { 
                    $set: { 
                        coinBalance: newBalance,
                        coinTransactions: transactions
                    }
                }
            );
            
            await updateCompanyBalance(transaction.amount, 'collected', `${email} bought ${transaction.coins} S-Coins at ${transaction.price} PKR each`);
            
            res.json({ success: true, message: `Approved ${transaction.coins} S-Coins for ${email}` });
        } else {
            transactions[transactionIndex].status = 'rejected';
            await usersCollection.updateOne(
                { email },
                { $set: { coinTransactions: transactions } }
            );
            res.json({ success: true, message: `Rejected coin purchase for ${email}` });
        }
    } catch (error) {
        console.error('Approve coin error:', error);
        res.json({ success: false, message: 'Error processing approval' });
    }
});

app.post('/approveCoinSell', requireAdmin, async (req, res) => {
    const { email, transactionId, approve } = req.body;
    
    if (!email || !transactionId) {
        return res.json({ success: false, message: 'Missing information' });
    }
    
    try {
        const user = await usersCollection.findOne({ email });
        if (!user) return res.json({ success: false, message: 'User not found' });
        
        const transactions = user.coinTransactions || [];
        const transactionIndex = transactions.findIndex(t => t.id === transactionId);
        
        if (transactionIndex === -1) {
            return res.json({ success: false, message: 'Transaction not found' });
        }
        
        if (approve) {
            const transaction = transactions[transactionIndex];
            const newBalance = (user.coinBalance || 0) - transaction.coins;
            
            if (newBalance < 0) {
                return res.json({ success: false, message: 'Insufficient coin balance' });
            }
            
            transactions[transactionIndex].status = 'completed';
            transactions[transactionIndex].approvedAt = new Date().toISOString();
            
            await usersCollection.updateOne(
                { email },
                { 
                    $set: { 
                        coinBalance: newBalance,
                        coinTransactions: transactions
                    }
                }
            );
            
            await updateCompanyBalance(transaction.amount, 'paid', `${email} sold ${transaction.coins} S-Coins at ${transaction.price} PKR each`);
            
            res.json({ success: true, message: `Approved sell of ${transaction.coins} S-Coins for ${email}. Amount ${transaction.amount} PKR to be sent to ${transaction.withdrawalMethod}: ${transaction.withdrawalAccount}` });
        } else {
            transactions[transactionIndex].status = 'rejected';
            await usersCollection.updateOne(
                { email },
                { $set: { coinTransactions: transactions } }
            );
            res.json({ success: true, message: `Rejected coin sell for ${email}` });
        }
    } catch (error) {
        console.error('Approve sell error:', error);
        res.json({ success: false, message: 'Error processing approval' });
    }
});

app.get('/getPendingCoinTransactions', requireAdmin, async (req, res) => {
    try {
        const users = await usersCollection.find({}).toArray();
        const pendingBuys = [];
        const pendingSells = [];
        
        for (const user of users) {
            const transactions = user.coinTransactions || [];
            for (const txn of transactions) {
                if (txn.status === 'pending') {
                    if (txn.type === 'buy_request') {
                        pendingBuys.push({
                            email: user.email,
                            transactionId: txn.id,
                            coins: txn.coins,
                            price: txn.price,
                            amount: txn.amount,
                            proofUrl: txn.proofUrl,
                            requestedAt: txn.requestedAt
                        });
                    } else if (txn.type === 'sell_request') {
                        pendingSells.push({
                            email: user.email,
                            transactionId: txn.id,
                            coins: txn.coins,
                            price: txn.price,
                            amount: txn.amount,
                            withdrawalMethod: txn.withdrawalMethod,
                            withdrawalAccount: txn.withdrawalAccount,
                            accountHolderName: txn.accountHolderName,
                            requestedAt: txn.requestedAt
                        });
                    }
                }
            }
        }
        
        res.json({ success: true, pendingBuys, pendingSells });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

app.get('/getAllCoinTransactions', requireAdmin, async (req, res) => {
    try {
        const users = await usersCollection.find({}).toArray();
        const allTransactions = [];
        
        for (const user of users) {
            const transactions = user.coinTransactions || [];
            for (const txn of transactions) {
                allTransactions.push({
                    email: user.email,
                    ...txn
                });
            }
        }
        
        allTransactions.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
        res.json({ success: true, transactions: allTransactions });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

// ===== START SERVER =====
connectDB().then((connected) => {
    if (connected) {
        app.listen(PORT, () => {
            console.log(`✅ S-CORP server running on port ${PORT}`);
            console.log(`💰 Currency: PKR`);
            console.log(`📊 Plans: 500, 1000, 1500 PKR`);
            console.log(`🎬 Video Commission: 30/40/50 PKR per video`);
            console.log(`👥 Referral Commission: 50/80/100 PKR`);
            console.log(`🎲 Lucky Draw: Active`);
            console.log(`🪙 S-Coin System: Active`);
            console.log(`🔐 Admin: ${ADMIN_EMAIL}`);
        });
    } else {
        console.log('❌ Server started but MongoDB connection failed');
    }
});