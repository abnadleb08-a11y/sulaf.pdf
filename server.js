// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const pdf = require('html-pdf');
const Jimp = require('jimp');
const Tesseract = require('tesseract.js');
const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const WebSocket = require('ws');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
    origin: ['*'],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/books', express.static(path.join(__dirname, 'books')));

// قاعدة البيانات MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://admin:password@cluster.mongodb.net/sulaf_pdf', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// نماذج البيانات
const BookSchema = new mongoose.Schema({
    title: { type: String, required: true },
    title_en: { type: String },
    author: { type: String, required: true },
    description: { type: String },
    description_en: { type: String },
    category: { 
        type: String, 
        required: true,
        enum: [
            'رواية', 'قصة', 'شعر', 'ديني', 'تاريخي', 'علمي', 
            'تطوير ذات', 'أطفال', 'سير ذاتية', 'فلسفة', 'اجتماعي'
        ]
    },
    subcategory: { type: String },
    tags: [{ type: String }],
    language: { type: String, default: 'ar' },
    fileUrl: { type: String, required: true },
    coverImage: { type: String, required: true },
    fileType: { type: String, enum: ['pdf', 'epub', 'txt', 'doc', 'audio'], required: true },
    fileSize: { type: Number },
    pages: { type: Number },
    duration: { type: Number },
    isFeatured: { type: Boolean, default: false },
    isFree: { type: Boolean, default: true },
    price: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    downloads: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    source: { type: String, enum: ['uploaded', 'scraped', 'ai_generated', 'user_upload'], default: 'uploaded' },
    sourceUrl: { type: String },
    externalId: { type: String },
    metadata: { type: Object },
    aiGenerated: { type: Boolean, default: false },
    qualityRating: { type: Number, min: 0, max: 5, default: 3 },
    lastUpdated: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    fullName: { type: String },
    phone: { type: String },
    avatar: { type: String },
    bio: { type: String },
    role: { type: String, enum: ['user', 'author', 'admin', 'super_admin'], default: 'user' },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    readingHistory: [{
        bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
        progress: { type: Number, default: 0 },
        lastRead: { type: Date },
        totalTime: { type: Number, default: 0 }
    }],
    library: [{
        bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
        addedAt: { type: Date, default: Date.now },
        isDownloaded: { type: Boolean, default: false }
    }],
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Book' }],
    bookmarks: [{
        bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
        page: { type: Number },
        note: { type: String },
        createdAt: { type: Date, default: Date.now }
    }],
    annotations: [{
        bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
        page: { type: Number },
        type: { type: String, enum: ['highlight', 'underline', 'note', 'drawing'] },
        content: { type: String },
        color: { type: String },
        position: { type: Object },
        createdAt: { type: Date, default: Date.now }
    }],
    achievements: [{
        type: { type: String },
        title: { type: String },
        description: { type: String },
        earnedAt: { type: Date, default: Date.now },
        icon: { type: String }
    }],
    stats: {
        totalBooksRead: { type: Number, default: 0 },
        totalReadingTime: { type: Number, default: 0 },
        readingStreak: { type: Number, default: 0 },
        lastReadingDay: { type: Date }
    },
    settings: {
        theme: { type: String, default: 'light' },
        fontSize: { type: Number, default: 16 },
        fontFamily: { type: String, default: 'Cairo' },
        autoScroll: { type: Boolean, default: false },
        ttsSpeed: { type: Number, default: 1 },
        ttsVoice: { type: String, default: 'ar-SA-Wavenet-A' },
        notifications: { type: Boolean, default: true },
        dataSaver: { type: Boolean, default: false }
    },
    tokens: [{
        token: { type: String },
        device: { type: String },
        lastUsed: { type: Date }
    }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const AdminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    permissions: [{ type: String }],
    lastLogin: { type: Date },
    loginHistory: [{
        ip: { type: String },
        device: { type: String },
        timestamp: { type: Date }
    }]
});

const BookRequestSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    title: { type: String, required: true },
    author: { type: String },
    reason: { type: String },
    status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
    source: { type: String },
    result: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
    createdAt: { type: Date, default: Date.now }
});

const AIStorySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    prompt: { type: String, required: true },
    genre: { type: String },
    language: { type: String, default: 'ar' },
    length: { type: String, enum: ['short', 'medium', 'long'], default: 'medium' },
    story: { type: String },
    images: [{ type: String }],
    pdfUrl: { type: String },
    status: { type: String, enum: ['generating', 'completed', 'failed'], default: 'generating' },
    createdAt: { type: Date, default: Date.now }
});

const Book = mongoose.model('Book', BookSchema);
const User = mongoose.model('User', UserSchema);
const Admin = mongoose.model('Admin', AdminSchema);
const BookRequest = mongoose.model('BookRequest', BookRequestSchema);
const AIStory = mongoose.model('AIStory', AIStorySchema);

// إعدادات التخزين للملفات
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = `uploads/${file.fieldname}s`;
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
    fileFilter: function (req, file, cb) {
        const allowedTypes = /pdf|epub|txt|doc|docx|jpg|jpeg|png|mp3|wav|m4a/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('نوع الملف غير مسموح به'));
        }
    }
});

// Middleware المصادقة
const authenticate = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            throw new Error();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'sulaf-pdf-secret-key');
        const user = await User.findOne({ _id: decoded.userId, 'tokens.token': token });

        if (!user) {
            throw new Error();
        }

        req.token = token;
        req.user = user;
        next();
    } catch (error) {
        res.status(401).send({ error: 'الرجاء تسجيل الدخول' });
    }
};

const authenticateAdmin = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            throw new Error();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'sulaf-pdf-secret-key');
        const admin = await Admin.findOne({ _id: decoded.adminId });

        if (!admin) {
            throw new Error();
        }

        req.admin = admin;
        next();
    } catch (error) {
        res.status(401).send({ error: 'غير مصرح بالوصول' });
    }
};

// 1. مسارات المستخدمين
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password, fullName } = req.body;
        
        const existingUser = await User.findOne({ 
            $or: [{ email }, { username }] 
        });
        
        if (existingUser) {
            return res.status(400).send({ error: 'البريد الإلكتروني أو اسم المستخدم موجود مسبقاً' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        const user = new User({
            username,
            email,
            password: hashedPassword,
            fullName,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName || username)}&background=random&color=fff`
        });

        await user.save();
        
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET || 'sulaf-pdf-secret-key',
            { expiresIn: '30d' }
        );

        user.tokens.push({ token, device: req.headers['user-agent'] });
        await user.save();

        res.status(201).send({ user, token });
    } catch (error) {
        res.status(400).send({ error: error.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).send({ error: 'بيانات الدخول غير صحيحة' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).send({ error: 'بيانات الدخول غير صحيحة' });
        }

        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET || 'sulaf-pdf-secret-key',
            { expiresIn: '30d' }
        );

        user.tokens.push({ token, device: req.headers['user-agent'] });
        await user.save();

        res.send({ user, token });
    } catch (error) {
        res.status(400).send({ error: error.message });
    }
});

// 2. مسارات الكتب
app.get('/api/books', async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 20, 
            category, 
            search, 
            author, 
            language,
            sort = 'newest'
        } = req.query;

        const query = {};
        
        if (category) query.category = category;
        if (author) query.author = new RegExp(author, 'i');
        if (language) query.language = language;
        if (search) {
            query.$or = [
                { title: new RegExp(search, 'i') },
                { author: new RegExp(search, 'i') },
                { description: new RegExp(search, 'i') },
                { tags: new RegExp(search, 'i') }
            ];
        }

        let sortOption = {};
        switch(sort) {
            case 'popular': sortOption = { views: -1 }; break;
            case 'downloads': sortOption = { downloads: -1 }; break;
            case 'likes': sortOption = { likes: -1 }; break;
            case 'featured': sortOption = { isFeatured: -1, createdAt: -1 }; break;
            default: sortOption = { createdAt: -1 };
        }

        const books = await Book.find(query)
            .sort(sortOption)
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .select('-fileUrl');

        const total = await Book.countDocuments(query);

        res.send({
            books,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

app.get('/api/books/:id', async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) {
            return res.status(404).send({ error: 'الكتاب غير موجود' });
        }

        // زيادة عدد المشاهدات
        book.views += 1;
        await book.save();

        res.send(book);
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

app.get('/api/books/:id/read', authenticate, async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) {
            return res.status(404).send({ error: 'الكتاب غير موجود' });
        }

        // تحديث سجل القراءة
        const readingHistory = req.user.readingHistory.find(
            h => h.bookId.toString() === req.params.id
        );

        if (readingHistory) {
            readingHistory.lastRead = new Date();
        } else {
            req.user.readingHistory.push({
                bookId: book._id,
                lastRead: new Date()
            });
        }

        await req.user.save();

        // إرسال محتوى الكتاب
        const filePath = path.join(__dirname, book.fileUrl);
        
        if (book.fileType === 'pdf') {
            res.sendFile(filePath);
        } else if (book.fileType === 'txt') {
            const content = fs.readFileSync(filePath, 'utf-8');
            res.send({ content });
        } else {
            res.send({ url: book.fileUrl });
        }
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

// 3. ميزة البحث الذكي في مواقع الكتب العربية
const ARABIC_BOOK_SOURCES = [
    {
        name: 'مكتبة نور',
        url: 'https://www.noor-book.com',
        searchUrl: 'https://www.noor-book.com/بحث/كتاب/',
        selectors: {
            items: '.book',
            title: '.book-title a',
            author: '.book-author',
            link: '.book-title a',
            cover: '.book-cover img',
            description: '.book-desc'
        }
    },
    {
        name: 'مكتبة الكتب',
        url: 'https://www.kutub-pdf.net',
        searchUrl: 'https://www.kutub-pdf.net/search?q=',
        selectors: {
            items: '.book-item',
            title: '.book-title',
            author: '.book-author',
            link: 'a',
            cover: 'img',
            description: '.book-description'
        }
    },
    {
        name: 'مكتبة العرب',
        url: 'https://www.arab-books.com',
        searchUrl: 'https://www.arab-books.com/search/',
        selectors: {
            items: '.book',
            title: '.title',
            author: '.author',
            link: 'a',
            cover: 'img',
            description: '.desc'
        }
    },
    {
        name: 'مكتبة المليون كتاب',
        url: 'https://www.million-books.com',
        searchUrl: 'https://www.million-books.com/search.php?q=',
        selectors: {
            items: '.book',
            title: 'h3',
            author: '.author',
            link: 'a',
            cover: 'img',
            description: '.description'
        }
    }
];

app.get('/api/search/external', async (req, res) => {
    try {
        const { query } = req.query;
        
        if (!query || query.length < 2) {
            return res.status(400).send({ error: 'يرجى إدخال مصطلح بحث مكون من حرفين على الأقل' });
        }

        const results = [];
        const searchPromises = ARABIC_BOOK_SOURCES.map(async (source) => {
            try {
                const response = await axios.get(`${source.searchUrl}${encodeURIComponent(query)}`, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    timeout: 10000
                });

                const $ = cheerio.load(response.data);
                const items = $(source.selectors.items).slice(0, 10);

                items.each((index, element) => {
                    const title = $(element).find(source.selectors.title).text().trim();
                    const author = $(element).find(source.selectors.author).text().trim();
                    const link = $(element).find(source.selectors.link).attr('href');
                    const cover = $(element).find(source.selectors.cover).attr('src');
                    const description = $(element).find(source.selectors.description).text().trim();

                    if (title) {
                        results.push({
                            source: source.name,
                            title,
                            author: author || 'غير معروف',
                            link: link ? (link.startsWith('http') ? link : `${source.url}${link}`) : null,
                            cover: cover ? (cover.startsWith('http') ? cover : `${source.url}${cover}`) : null,
                            description: description || 'لا يوجد وصف',
                            external: true
                        });
                    }
                });
            } catch (error) {
                console.error(`Error scraping ${source.name}:`, error.message);
            }
        });

        await Promise.all(searchPromises);

        // إضافة بحث داخلي أيضاً
        const internalBooks = await Book.find({
            $or: [
                { title: new RegExp(query, 'i') },
                { author: new RegExp(query, 'i') },
                { tags: new RegExp(query, 'i') }
            ]
        }).limit(20).select('title author coverImage description');

        internalBooks.forEach(book => {
            results.push({
                source: 'سولف PDF',
                title: book.title,
                author: book.author,
                link: null,
                cover: book.coverImage,
                description: book.description,
                external: false,
                bookId: book._id
            });
        });

        res.send({ results });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

// 4. تحميل الكتب من المواقع الخارجية تلقائياً
app.post('/api/books/download-external', authenticate, async (req, res) => {
    try {
        const { url, title, author, category } = req.body;
        
        // إنشاء طلب تحميل
        const bookRequest = new BookRequest({
            userId: req.user._id,
            title,
            author,
            source: url,
            status: 'processing'
        });

        await bookRequest.save();

        // بدء عملية التحميل في الخلفية
        downloadBookFromUrl(url, title, author, category, bookRequest._id);

        res.send({ 
            message: 'تم بدء عملية تحميل الكتاب', 
            requestId: bookRequest._id 
        });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

async function downloadBookFromUrl(url, title, author, category, requestId) {
    try {
        // استخدام Puppeteer لجلب الصفحة
        const browser = await puppeteer.launch({ 
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle2' });

        // محاولة العثور على رابط التحميل
        const downloadUrl = await page.evaluate(() => {
            // بحث عن روابط التحميل الشائعة
            const downloadLinks = Array.from(document.querySelectorAll('a'))
                .filter(a => {
                    const text = a.textContent.toLowerCase();
                    const href = a.href.toLowerCase();
                    return text.includes('تحميل') || 
                           text.includes('download') || 
                           href.includes('.pdf') ||
                           href.includes('.epub') ||
                           href.includes('.txt');
                })
                .map(a => a.href);

            return downloadLinks[0];
        });

        if (!downloadUrl) {
            throw new Error('لم يتم العثور على رابط تحميل');
        }

        // تحميل الملف
        const response = await axios({
            method: 'GET',
            url: downloadUrl,
            responseType: 'stream'
        });

        const fileName = `${Date.now()}-${title.replace(/[^a-z0-9]/gi, '_')}.pdf`;
        const filePath = path.join(__dirname, 'books', fileName);
        
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        // إنشاء غلاف للكتاب
        const coverPath = await generateBookCover(title, author);

        // حفظ الكتاب في قاعدة البيانات
        const book = new Book({
            title,
            author,
            category: category || 'رواية',
            fileUrl: `/books/${fileName}`,
            coverImage: `/uploads/covers/${path.basename(coverPath)}`,
            fileType: 'pdf',
            fileSize: fs.statSync(filePath).size,
            source: 'scraped',
            sourceUrl: url,
            metadata: {
                downloadedAt: new Date(),
                originalUrl: url
            }
        });

        await book.save();

        // تحديث حالة الطلب
        await BookRequest.findByIdAndUpdate(requestId, {
            status: 'completed',
            result: book._id
        });

        await browser.close();
        
        console.log(`تم تحميل الكتاب بنجاح: ${title}`);
    } catch (error) {
        console.error('خطأ في تحميل الكتاب:', error);
        
        await BookRequest.findByIdAndUpdate(requestId, {
            status: 'failed'
        });
    }
}

async function generateBookCover(title, author) {
    try {
        // إنشاء صورة غلاف باستخدام Jimp
        const width = 800;
        const height = 1200;
        
        const image = new Jimp(width, height, '#2c3e50');
        
        // إضافة تدرج لوني
        for (let y = 0; y < height; y++) {
            const color = Jimp.rgbaToInt(
                44 + Math.floor(y * 100 / height),
                62 + Math.floor(y * 50 / height),
                80 + Math.floor(y * 30 / height),
                255
            );
            for (let x = 0; x < width; x++) {
                image.setPixelColor(color, x, y);
            }
        }
        
        // تحميل خط عربي (يمكن استخدام خط افتراضي)
        const font = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
        const smallFont = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
        
        // كتابة العنوان
        const titleX = width / 2;
        const titleY = height / 2 - 100;
        image.print(font, titleX - 300, titleY, {
            text: title,
            alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
            alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
        }, width - 100);
        
        // كتابة اسم المؤلف
        const authorY = height / 2 + 50;
        image.print(smallFont, titleX - 200, authorY, {
            text: author,
            alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
            alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
        }, width - 100);
        
        // إضافة شعار
        const logo = `سولف PDF`;
        image.print(smallFont, width / 2 - 100, height - 100, logo);
        
        const fileName = `cover-${Date.now()}.jpg`;
        const filePath = path.join(__dirname, 'uploads/covers', fileName);
        
        await image.writeAsync(filePath);
        
        return filePath;
    } catch (error) {
        // استخدام صورة افتراضية في حالة الخطأ
        const defaultCover = 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
        return defaultCover;
    }
}

// 5. ميزة الذكاء الاصطناعي لإنشاء القصص
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/ai/generate-story', authenticate, async (req, res) => {
    try {
        const { prompt, genre, length, language } = req.body;
        
        const aiStory = new AIStory({
            userId: req.user._id,
            prompt,
            genre,
            length,
            language: language || 'ar'
        });

        await aiStory.save();

        // بدء إنشاء القصة في الخلفية
        generateAIStory(aiStory._id, prompt, genre, length, language);

        res.send({ 
            message: 'بدأ إنشاء القصة', 
            storyId: aiStory._id 
        });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

async function generateAIStory(storyId, prompt, genre, length, language) {
    try {
        const aiStory = await AIStory.findById(storyId);
        
        // استخدام Gemini AI (مجاني من جوجل)
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        
        const systemPrompt = `
        أنت كاتب عربي محترف. اكتب ${length === 'short' ? 'قصة قصيرة' : length === 'medium' ? 'رواية متوسطة' : 'رواية طويلة'} 
        باللغة ${language === 'ar' ? 'العربية' : language}.
        النوع: ${genre}
        الفكرة: ${prompt}
        
        المتطلبات:
        1. اكتب باللغة العربية الفصحى أو العامية حسب السياق
        2. أضف شخصيات متطورة
        3. أضف حوارات طبيعية
        4. أضف عنصر التشويق
        5. النهاية يجب أن تكون مرضية
        
        ابدأ الكتابة مباشرة:
        `;

        const result = await model.generateContent(systemPrompt);
        const story = result.response.text();

        // حفظ القصة
        aiStory.story = story;
        aiStory.status = 'completed';
        await aiStory.save();

        // إنشاء PDF من القصة
        const pdfPath = await createPDFFromStory(story, prompt);
        aiStory.pdfUrl = pdfPath;
        await aiStory.save();

        // إنشاء صور توضيحية باستخدام DALL-E
        if (process.env.OPENAI_API_KEY) {
            const images = await generateStoryImages(story);
            aiStory.images = images;
            await aiStory.save();
        }

    } catch (error) {
        console.error('خطأ في إنشاء القصة:', error);
        await AIStory.findByIdAndUpdate(storyId, {
            status: 'failed'
        });
    }
}

async function createPDFFromStory(story, title) {
    try {
        const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>${title}</title>
            <style>
                body {
                    font-family: 'Cairo', 'Arial', sans-serif;
                    line-height: 1.8;
                    margin: 40px;
                    text-align: right;
                    direction: rtl;
                }
                h1 {
                    text-align: center;
                    color: #2c3e50;
                    margin-bottom: 40px;
                }
                .content {
                    font-size: 18px;
                    text-align: justify;
                }
                .chapter {
                    margin-bottom: 40px;
                    page-break-inside: avoid;
                }
                .footer {
                    text-align: center;
                    margin-top: 50px;
                    color: #7f8c8d;
                    font-size: 14px;
                }
            </style>
        </head>
        <body>
            <h1>${title}</h1>
            <div class="content">
                ${story.replace(/\n/g, '<br>')}
            </div>
            <div class="footer">
                تم إنشاء هذه القصة بواسطة تطبيق سولف PDF باستخدام الذكاء الاصطناعي
            </div>
        </body>
        </html>
        `;

        const options = {
            format: 'A4',
            orientation: 'portrait',
            border: '20mm',
            footer: {
                height: "10mm",
                contents: {
                    default: '<span style="color: #444;">{{page}}/{{pages}}</span>'
                }
            }
        };

        const fileName = `story-${Date.now()}.pdf`;
        const filePath = path.join(__dirname, 'uploads/stories', fileName);
        
        await new Promise((resolve, reject) => {
            pdf.create(htmlContent, options).toFile(filePath, (err, res) => {
                if (err) reject(err);
                else resolve(res);
            });
        });

        return `/uploads/stories/${fileName}`;
    } catch (error) {
        console.error('خطأ في إنشاء PDF:', error);
        return null;
    }
}

// 6. لوحة التحكم الإدارية
app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
    try {
        const totalBooks = await Book.countDocuments();
        const totalUsers = await User.countDocuments();
        const totalDownloads = await Book.aggregate([
            { $group: { _id: null, total: { $sum: "$downloads" } } }
        ]);
        const recentBooks = await Book.find()
            .sort({ createdAt: -1 })
            .limit(10)
            .select('title author downloads views createdAt');
        
        const popularBooks = await Book.find()
            .sort({ downloads: -1 })
            .limit(10)
            .select('title author downloads');
        
        const userGrowth = await User.aggregate([
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" },
                        day: { $dayOfMonth: "$createdAt" }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
            { $limit: 30 }
        ]);

        res.send({
            totalBooks,
            totalUsers,
            totalDownloads: totalDownloads[0]?.total || 0,
            recentBooks,
            popularBooks,
            userGrowth
        });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

app.post('/api/admin/books', authenticateAdmin, upload.fields([
    { name: 'bookFile', maxCount: 1 },
    { name: 'coverImage', maxCount: 1 }
]), async (req, res) => {
    try {
        const { title, author, description, category, language, isFree, price } = req.body;
        
        if (!req.files.bookFile) {
            return res.status(400).send({ error: 'يرجى رفع ملف الكتاب' });
        }

        const bookFile = req.files.bookFile[0];
        const coverImage = req.files.coverImage ? req.files.coverImage[0] : null;

        const book = new Book({
            title,
            author,
            description,
            category,
            language: language || 'ar',
            fileUrl: `/uploads/books/${bookFile.filename}`,
            coverImage: coverImage ? `/uploads/covers/${coverImage.filename}` : await generateBookCover(title, author),
            fileType: bookFile.mimetype.split('/')[1],
            fileSize: bookFile.size,
            isFree: isFree !== 'false',
            price: isFree === 'false' ? parseFloat(price) || 0 : 0,
            source: 'uploaded'
        });

        await book.save();

        res.status(201).send({ 
            message: 'تم إضافة الكتاب بنجاح',
            book 
        });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

app.put('/api/admin/books/:id', authenticateAdmin, async (req, res) => {
    try {
        const updates = req.body;
        const book = await Book.findByIdAndUpdate(
            req.params.id,
            { ...updates, updatedAt: new Date() },
            { new: true, runValidators: true }
        );

        if (!book) {
            return res.status(404).send({ error: 'الكتاب غير موجود' });
        }

        res.send({ message: 'تم تحديث الكتاب', book });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

app.delete('/api/admin/books/:id', authenticateAdmin, async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        
        if (!book) {
            return res.status(404).send({ error: 'الكتاب غير موجود' });
        }

        // حذف الملفات من الخادم
        if (book.fileUrl && book.fileUrl.startsWith('/uploads/')) {
            const filePath = path.join(__dirname, book.fileUrl);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        if (book.coverImage && book.coverImage.startsWith('/uploads/')) {
            const coverPath = path.join(__dirname, book.coverImage);
            if (fs.existsSync(coverPath)) {
                fs.unlinkSync(coverPath);
            }
        }

        await book.deleteOne();

        res.send({ message: 'تم حذف الكتاب بنجاح' });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, search } = req.query;
        
        const query = {};
        if (search) {
            query.$or = [
                { username: new RegExp(search, 'i') },
                { email: new RegExp(search, 'i') },
                { fullName: new RegExp(search, 'i') }
            ];
        }

        const users = await User.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .select('-password -tokens');

        const total = await User.countDocuments(query);

        res.send({
            users,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

// 7. OCR لتحويل الصور إلى نص
app.post('/api/ocr/extract-text', authenticate, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send({ error: 'يرجى رفع صورة' });
        }

        const imagePath = req.file.path;
        
        const result = await Tesseract.recognize(
            imagePath,
            'ara+eng', // العربية والإنجليزية
            {
                logger: m => console.log(m)
            }
        );

        // حذف الصورة المؤقتة
        fs.unlinkSync(imagePath);

        res.send({ 
            text: result.data.text,
            confidence: result.data.confidence
        });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

// 8. Text-to-Speech
app.post('/api/tts/convert', authenticate, async (req, res) => {
    try {
        const { text, language = 'ar', speed = 1.0 } = req.body;
        
        if (!text || text.length > 5000) {
            return res.status(400).send({ error: 'النص يجب أن يكون بين 1 و 5000 حرف' });
        }

        // استخدام Google TTS API
        const textToSpeech = require('@google-cloud/text-to-speech');
        const client = new textToSpeech.TextToSpeechClient();

        const request = {
            input: { text },
            voice: {
                languageCode: language === 'ar' ? 'ar-SA' : 'en-US',
                name: language === 'ar' ? 'ar-SA-Wavenet-A' : 'en-US-Wavenet-A',
                ssmlGender: 'FEMALE'
            },
            audioConfig: {
                audioEncoding: 'MP3',
                speakingRate: speed,
                pitch: 0.0,
                volumeGainDb: 0.0
            }
        };

        const [response] = await client.synthesizeSpeech(request);
        
        const fileName = `tts-${Date.now()}.mp3`;
        const filePath = path.join(__dirname, 'uploads/audio', fileName);
        
        fs.writeFileSync(filePath, response.audioContent, 'binary');

        res.send({
            audioUrl: `/uploads/audio/${fileName}`,
            duration: Math.ceil(text.length / 15) // تقدير المدة
        });
    } catch (error) {
        // استخدام بديل إذا لم يكن Google TTS متاحاً
        const fileName = `tts-${Date.now()}.mp3`;
        const filePath = path.join(__dirname, 'uploads/audio', fileName);
        
        // إنشاء ملف صوتي وهمي للعرض
        const dummyAudio = Buffer.from('RIFFxxxxWAVEfmt\x10\x00\x00\x00\x01\x00\x01\x00\x00\x04\x00\x00\x00\x04\x00\x00\x01\x00\x08\x00data');
        fs.writeFileSync(filePath, dummyAudio);

        res.send({
            audioUrl: `/uploads/audio/${fileName}`,
            duration: Math.ceil(text.length / 15),
            note: 'هذا صوت تجريبي. في الإصدار الكامل سيتم استخدام Google TTS الحقيقي'
        });
    }
});

// 9. نظام التنبيهات والإشعارات
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
    console.log('عميل متصل');
    
    ws.on('message', (message) => {
        console.log('رسالة واردة:', message);
    });
    
    ws.on('close', () => {
        console.log('عميل مغلق');
    });
});

function sendNotification(userId, type, title, message) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                userId,
                type,
                title,
                message,
                timestamp: new Date()
            }));
        }
    });
}

// 10. مسارات إضافية
app.get('/api/categories', async (req, res) => {
    try {
        const categories = await Book.aggregate([
            { $group: { _id: "$category", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        
        res.send(categories);
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

app.get('/api/authors', async (req, res) => {
    try {
        const authors = await Book.aggregate([
            { $group: { _id: "$author", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 50 }
        ]);
        
        res.send(authors);
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

app.post('/api/books/:id/like', authenticate, async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        
        if (!book) {
            return res.status(404).send({ error: 'الكتاب غير موجود' });
        }

        book.likes += 1;
        await book.save();

        res.send({ likes: book.likes });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

app.post('/api/books/:id/download', authenticate, async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        
        if (!book) {
            return res.status(404).send({ error: 'الكتاب غير موجود' });
        }

        book.downloads += 1;
        await book.save();

        // إضافة إلى مكتبة المستخدم
        const libraryItem = req.user.library.find(
            item => item.bookId.toString() === req.params.id
        );

        if (!libraryItem) {
            req.user.library.push({
                bookId: book._id,
                isDownloaded: true
            });
            await req.user.save();
        }

        res.send({
            downloadUrl: book.fileUrl,
            downloads: book.downloads
        });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

// إنشاء مجلدات التخزين
const folders = ['uploads/books', 'uploads/covers', 'uploads/audio', 'uploads/stories', 'books'];
folders.forEach(folder => {
    const folderPath = path.join(__dirname, folder);
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }
});

// إعداد المستخدم الإداري الافتراضي
async function createDefaultAdmin() {
    try {
        const adminExists = await Admin.findOne({ username: 'admin' });
        
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            
            const admin = new Admin({
                username: 'admin',
                email: 'admin@sulafpdf.com',
                password: hashedPassword,
                permissions: ['all']
            });

            await admin.save();
            console.log('تم إنشاء المستخدم الإداري الافتراضي');
        }
    } catch (error) {
        console.error('خطأ في إنشاء المستخدم الإداري:', error);
    }
}

// تشغيل الخادم
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ الخادم يعمل على المنفذ ${PORT}`);
    console.log(`📚 قاعدة البيانات: ${mongoose.connection.readyState === 1 ? 'متصل' : 'غير متصل'}`);
    console.log(`🌐 لوحة التحكم: http://localhost:${PORT}/admin`);
    console.log(`📱 API: http://localhost:${PORT}/api`);
    
    createDefaultAdmin();
});
