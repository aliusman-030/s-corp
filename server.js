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

// ===== MONGODB CONNECTION STRING =====
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://s-corp-user:S-Corp2026@cluster0.rjxsj7i.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const DB_NAME = 's-corp';

// ===== MIDDLEWARE =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'Public')));
app.use('/uploads', express.static(path.join(__dirname, 'Uploads')));

// ===== SESSION CONFIGURATION - FIXED FOR PERSISTENCE =====
app.use(session({
    secret: process.env.SESSION_SECRET || 's-corp-super-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: MONGODB_URI,
        dbName: DB_NAME,
        collectionName: 'sessions',
        ttl: 24 * 60 * 60,
        touchAfter: 24 * 3600
    }),
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax'
    },
    name: 's-corp.sid'
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

let db;
let usersCollection;
let videosCollection;
let paymentMethodsCollection;
let companyBalanceCollection;

// ===== PERMANENT ADMIN =====
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@site.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Abac@123';

// ===== MULTER SETUP =====
const UPLOADS_DIR = path.join(__dirname, 'Uploads');
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
        
        console.log('✅ Connected to MongoDB');
        await initializeDB();
        return true;
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        return false;
    }
}

// ===== INITIALIZE DATABASE =====
async function initializeDB() {
    try {
        const adminExists = await usersCollection.findOne({ email: ADMIN_EMAIL });
        if (!adminExists) {
            const hashedAdminPass = await bcrypt.hash(ADMIN_PASSWORD, 10);
            await usersCollection.insertOne({
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
                _id: 'balance',
                totalCollected: 0,
                totalPaid: 0,
                totalCommissionPaid: 0,
                balance: 0,
                transactions: []
            });
            console.log('✓ Created company balance');
        }
    } catch (error) {
        console.error('Error initializing DB:', error);
    }
}

// ===== HELPER FUNCTIONS =====
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
    
    await companyBalanceCollection.updateOne(
        { _id: 'balance' },
        { $set: company },
        { upsert: true }
    );
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
        { 
            $inc: { 
                totalReferralsAdded: 1,
                referralsWithoutPlan: 1
            }
        }
    );
    
    console.log(`📊 Referral counted: ${referredBy} referred ${childEmail} (plan selected: ${planName})`);
    return true;
}

async function processReferralCommission(childEmail, planName) {
    console.log(`💰 [COMMISSION] Starting for ${childEmail} with plan ${planName}`);
    
    const child = await usersCollection.findOne({ email: childEmail });
    if (!child) {
        console.log(`❌ Child ${childEmail} not found`);
        return false;
    }
    
    const referredBy = child.referredBy;
    if (!referredBy || referredBy === '') {
        console.log(`❌ Child ${childEmail} has no referrer`);
        return false;
    }
    
    console.log(`🔍 Child's referrer: ${referredBy}`);
    
    const parent = await usersCollection.findOne({ email: referredBy });
    if (!parent) {
        console.log(`❌ Parent ${referredBy} not found`);
        return false;
    }
    
    console.log(`🔍 Parent found: ${parent.email}, current balance: ${parent.amount}, plan: ${parent.plan}`);
    
    const planData = PLANS[planName];
    if (!planData) {
        console.log(`❌ Plan ${planName} not found`);
        return false;
    }
    
    if (!parent.plan || parent.plan === '') {
        console.log(`❌ Parent ${referredBy} has no plan, cannot receive commission`);
        return false;
    }
    
    const commission = planData.referralCommission;
    const currentParentBalance = parseFloat(parent.amount) || 0;
    const newBalance = currentParentBalance + commission;
    
    console.log(`💵 Adding ${commission} PKR to ${referredBy} (${currentParentBalance} → ${newBalance})`);
    
    const updateResult = await usersCollection.updateOne(
        { email: referredBy },
        { 
            $set: { 
                amount: newBalance,
                referralEarnings: (parent.referralEarnings || 0) + commission
            }
        }
    );
    
    console.log(`📊 Update result: matched=${updateResult.matchedCount}, modified=${updateResult.modifiedCount}`);
    
    await usersCollection.updateOne(
        { email: referredBy },
        { 
            $inc: { 
                referralsWithPlan: 1,
                referralsWithoutPlan: -1
            }
        }
    );
    
    await updateCompanyBalance(commission, 'commission', `Referral commission paid to ${referredBy} for referring ${childEmail} (${planName})`);
    
    console.log(`✅ SUCCESS: ${referredBy} earned ${commission} PKR! New balance: ${newBalance}`);
    return true;
}

// ===== MIDDLEWARE =====
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
        if (referralCode) {
            const referringUser = await usersCollection.findOne({ referral: referralCode });
            if (referringUser) {
                referredBy = referringUser.email;
                console.log(`🔗 User ${email} signed up with referral from ${referredBy}`);
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
        
        if (!email || !password) {
            return res.json({ success: false, message: 'Email and password required' });
        }
        
        const user = await usersCollection.findOne({ email });
        
        if (!user) return res.json({ success: false, message: 'User not found' });
        
        const match = await bcrypt.compare(password, user.hashedPassword || user.password);
        if (!match) return res.json({ success: false, message: 'Incorrect password' });
        
        req.session.user = email;
        req.session.isAdmin = email === ADMIN_EMAIL;
        
        // Force save session
        req.session.save((err) => {
            if (err) console.error('Session save error:', err);
        });
        
        res.json({ success: true, message: 'Login successful!', isAdmin: email === ADMIN_EMAIL });
    } catch (e) {
        console.error('Login error:', e);
        res.json({ success: false, message: 'Server error during login' });
    }
});

// LOGOUT
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error('Logout error:', err);
        res.redirect('/login.html');
    });
});

// PROFILE DATA
app.get('/profileData', requireLogin, async (req, res) => {
    try {
        let user = await usersCollection.findOne({ email: req.session.user });
        
        if (!user) {
            req.session.destroy();
            return res.status(404).json({ message: 'User not found' });
        }
        
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
            amount: (parseFloat(user.amount) || 0).toFixed(2),
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
        
        res.json(response);
    } catch (e) {
        console.error('Profile data error:', e);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET DEPOSIT METHODS
app.get('/getDepositMethods', async (req, res) => {
    try {
        const methodsDoc = await paymentMethodsCollection.findOne({ _id: 'methods' });
        res.json(methodsDoc?.methods || []);
    } catch (e) {
        res.json([]);
    }
});

// SAVE DEPOSIT METHODS
app.post('/saveDepositMethods', requireAdmin, async (req, res) => {
    const { methods } = req.body;
    
    if (!Array.isArray(methods)) {
        return res.json({ success: false, message: 'Invalid data format' });
    }
    
    const methodsWithType = methods.map(method => ({
        ...method,
        type: 'deposit'
    }));
    
    await paymentMethodsCollection.updateOne(
        { _id: 'methods' },
        { $set: { methods: methodsWithType } },
        { upsert: true }
    );
    
    res.json({ success: true, message: `Updated ${methods.length} deposit methods` });
});

// GET COMPANY BALANCE
app.get('/getCompanyBalance', requireAdmin, async (req, res) => {
    try {
        const company = await companyBalanceCollection.findOne({ _id: 'balance' }) || {
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

// GET USERS
app.get('/getUsers', requireAdmin, async (req, res) => {
    try {
        const users = await usersCollection.find({}).toArray();
        
        const usersWithStats = users.map(user => {
            const planData = user.plan ? PLANS[user.plan] : null;
            
            return {
                email: user.email,
                plan: user.plan || '',
                amount: (parseFloat(user.amount) || 0).toFixed(2),
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
                referredBy: user.referredBy || ''
            };
        });
        
        res.json(usersWithStats);
    } catch (e) {
        res.json([]);
    }
});

// GET VIDEOS
app.get('/getVideos', async (req, res) => {
    try {
        const videosDoc = await videosCollection.findOne({ _id: 'videos' });
        const { _id, ...videos } = videosDoc || {};
        res.json(videos || {});
    } catch (e) {
        res.json({});
    }
});

// SAVE VIDEOS
app.post('/saveVideos', requireAdmin, async (req, res) => {
    try {
        await videosCollection.updateOne(
            { _id: 'videos' },
            { $set: req.body },
            { upsert: true }
        );
        console.log('✅ Videos saved');
        res.json({ success: true, message: 'Videos saved!' });
    } catch (e) {
        res.json({ success: false, message: 'Error saving videos' });
    }
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
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }
        
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

// UPLOAD PAYMENT PROOF
app.post('/upload', requireLogin, upload.single('media'), async (req, res) => {
    try {
        if (!req.file) {
            return res.json({ success: false, message: 'No file uploaded' });
        }
        
        const user = await usersCollection.findOne({ email: req.session.user });
        if (!user) return res.json({ success: false, message: 'User not found' });
        
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
        
        const uploads = user.uploads || [];
        uploads.push(fileInfo);
        
        await usersCollection.updateOne(
            { email: req.session.user },
            { $set: { uploads: uploads } }
        );
        
        res.json({ success: true, message: 'Payment proof uploaded! Waiting for admin approval.' });
        
    } catch (error) {
        console.error('Upload error:', error);
        res.json({ success: false, message: error.message || 'Error uploading file' });
    }
});

// ===== TOGGLE VIDEO ACCESS - COMMISSION PAID HERE =====
app.post('/toggleVideoAccess', requireAdmin, async (req, res) => {
    const { email, grantAccess } = req.body;
    
    console.log(`🔘 Toggle video access: ${email} -> ${grantAccess ? 'ON' : 'OFF'}`);
    
    if (!email) return res.json({ success: false, message: 'Email required' });
    
    try {
        const user = await usersCollection.findOne({ email });
        if (!user) return res.json({ success: false, message: 'User not found' });
        
        const planData = PLANS[user.plan];
        if (!planData && grantAccess) {
            return res.json({ success: false, message: 'User has no plan selected. Cannot grant access.' });
        }
        
        const userPlan = user.plan;
        const wasGranted = user.grantedVideos;
        
        await usersCollection.updateOne(
            { email },
            { 
                $set: { 
                    grantedVideos: grantAccess === true,
                    isPaid: grantAccess === true,
                    videoAccessGrantedAt: grantAccess ? new Date().toISOString() : null,
                    paidAmount: grantAccess && planData ? planData.price : 0
                }
            }
        );
        
        if (grantAccess && !wasGranted) {
            await updateCompanyBalance(planData.price, 'collected', `Payment from ${email} for ${user.plan}`);
            
            console.log(`🎯 Calling processReferralCommission for ${email} with plan ${userPlan}`);
            const commissionResult = await processReferralCommission(email, userPlan);
            console.log(`📊 Commission result: ${commissionResult}`);
            
            console.log(`✅ GRANTED video access to ${email} for plan ${user.plan}`);
        }
        
        res.json({ 
            success: true, 
            message: grantAccess ? `Video access GRANTED to ${email}` : `Video access REVOKED from ${email}`,
            grantedVideos: grantAccess
        });
    } catch (error) {
        console.error('Toggle error:', error);
        res.json({ success: false, message: 'Server error' });
    }
});

// PROCESS WITHDRAWAL
app.post('/processWithdrawal', requireAdmin, async (req, res) => {
    const { email } = req.body;
    
    if (!email) return res.json({ success: false, message: 'Email required' });
    
    try {
        const user = await usersCollection.findOne({ email });
        if (!user) return res.json({ success: false, message: 'User not found' });
        
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
        
        const newUserBalance = currentUserBalance - withdrawalAmount;
        
        await usersCollection.updateOne(
            { email },
            { 
                $set: { 
                    amount: newUserBalance,
                    withdrawalRequested: false,
                    withdrawalMessage: `PAID - ${withdrawalAmount} PKR paid on ${new Date().toLocaleString()}`
                }
            }
        );
        
        await updateCompanyBalance(withdrawalAmount, 'paid', `Withdrawal paid to ${email}`);
        
        console.log(`💰 Withdrawal processed: ${email} | Amount: ${withdrawalAmount} PKR | New balance: ${newUserBalance}`);
        
        res.json({ 
            success: true, 
            message: `Withdrawal of ${withdrawalAmount} PKR processed for ${email}`,
            newBalance: newUserBalance
        });
    } catch (error) {
        console.error('Withdrawal error:', error);
        res.json({ success: false, message: 'Server error' });
    }
});

// MARK VIDEO AS WATCHED
app.post('/markVideoWatched', requireLogin, async (req, res) => {
    const { videoKey, videoUrl } = req.body;
    const userEmail = req.session.user;
    
    try {
        let user = await usersCollection.findOne({ email: userEmail });
        if (!user) return res.json({ success: false, message: 'User not found' });
        
        await checkAndResetDailyCounters(user);
        user = await usersCollection.findOne({ email: userEmail });
        
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
        
        const watchedKeys = user.watchedKeys || [];
        if (watchedKeys.includes(videoKey)) {
            return res.json({ success: false, message: `This video already watched today! Come back tomorrow.` });
        }
        
        watchedKeys.push(videoKey);
        const earnings = planData.videoCommission;
        const currentAmount = parseFloat(user.amount) || 0;
        const newAmount = currentAmount + earnings;
        
        await usersCollection.updateOne(
            { email: userEmail },
            { 
                $set: { 
                    watchedKeys: watchedKeys,
                    dailyVideosWatched: (user.dailyVideosWatched || 0) + 1,
                    amount: newAmount,
                    videoEarnings: (user.videoEarnings || 0) + earnings
                }
            }
        );
        
        res.json({ 
            success: true, 
            message: `🎉 +${earnings} PKR earned!`,
            earnings: earnings,
            dailyVideosWatched: (user.dailyVideosWatched || 0) + 1,
            dailyVideoLimit: planData.dailyVideos,
            amount: newAmount
        });
    } catch (error) {
        console.error('Mark video error:', error);
        res.json({ success: false, message: 'Server error' });
    }
});

// REQUEST WITHDRAWAL
app.post('/requestWithdrawal', requireLogin, async (req, res) => {
    try {
        const user = await usersCollection.findOne({ email: req.session.user });
        if (!user) return res.json({ success: false, message: 'User not found' });
        
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
        
        await usersCollection.updateOne(
            { email: req.session.user },
            { 
                $set: { 
                    withdrawalRequested: true,
                    withdrawalMessage: `PENDING - ${withdrawalLimit} PKR requested on ${new Date().toLocaleString()}`
                }
            }
        );
        
        res.json({ success: true, message: 'Withdrawal requested! Admin will process it soon.' });
    } catch (error) {
        console.error('Request withdrawal error:', error);
        res.json({ success: false, message: 'Server error' });
    }
});

// SAVE WITHDRAWAL INFO
app.post('/saveWithdrawalInfo', requireLogin, async (req, res) => {
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
    
    try {
        await usersCollection.updateOne(
            { email: req.session.user },
            { 
                $set: { 
                    withdrawalMethod: withdrawalMethod,
                    withdrawalAccount: withdrawalAccount,
                    accountHolderName: accountHolderName,
                    accountTitle: accountTitle || ''
                }
            }
        );
        
        res.json({ success: true, message: 'Withdrawal information saved successfully!' });
    } catch (error) {
        console.error('Save withdrawal error:', error);
        res.json({ success: false, message: 'Server error' });
    }
});

// DELETE USER
app.post('/deleteUser', requireAdmin, async (req, res) => {
    const { email } = req.body;
    
    if (!email) return res.json({ success: false, message: 'Email required' });
    
    if (email === ADMIN_EMAIL) {
        return res.json({ success: false, message: 'Cannot delete admin account' });
    }
    
    try {
        await usersCollection.deleteOne({ email: email });
        console.log(`🗑️ Admin deleted user: ${email}`);
        res.json({ success: true, message: `User ${email} deleted successfully` });
    } catch (error) {
        res.json({ success: false, message: 'Error deleting user' });
    }
});

// RESET DAILY COUNTERS
app.post('/resetDailyCounters', requireAdmin, async (req, res) => {
    try {
        const now = new Date().toISOString();
        const result = await usersCollection.updateMany(
            { email: { $ne: ADMIN_EMAIL } },
            { 
                $set: { 
                    dailyVideosWatched: 0, 
                    watched: [], 
                    watchedKeys: [], 
                    lastDailyReset: now 
                }
            }
        );
        console.log(`🔄 Admin reset daily counters for ${result.modifiedCount} users`);
        res.json({ success: true, message: `Daily counters reset for ${result.modifiedCount} users` });
    } catch (error) {
        res.json({ success: false, message: 'Error resetting counters' });
    }
});

// RESET COMPANY BALANCE
app.post('/resetCompanyBalance', requireAdmin, async (req, res) => {
    try {
        const defaultCompanyBalance = {
            _id: 'balance',
            totalCollected: 0,
            totalPaid: 0,
            totalCommissionPaid: 0,
            balance: 0,
            transactions: []
        };
        await companyBalanceCollection.updateOne(
            { _id: 'balance' },
            { $set: defaultCompanyBalance },
            { upsert: true }
        );
        console.log('🏦 Company balance reset to 0 by admin');
        res.json({ success: true, message: 'Company balance reset to 0' });
    } catch (e) {
        res.json({ success: false, message: 'Error resetting balance' });
    }
});

// FORCE CREATE ADMIN
app.get('/force-create-admin', async (req, res) => {
    try {
        if (!usersCollection) {
            return res.json({ success: false, error: 'MongoDB not connected yet' });
        }
        
        const hashedAdminPass = await bcrypt.hash(ADMIN_PASSWORD, 10);
        await usersCollection.updateOne(
            { email: ADMIN_EMAIL },
            { 
                $set: {
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
                }
            },
            { upsert: true }
        );
        res.json({ success: true, message: 'Admin created/updated' });
    } catch (error) {
        res.json({ success: false, error: error.message });
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
            console.log(`👥 Referral Commission: 50/80/100 PKR (paid when child gets video access)`);
            console.log(`🔐 Admin: ${ADMIN_EMAIL}`);
        });
    } else {
        console.log('❌ Server started but MongoDB connection failed');
    }
});