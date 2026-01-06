// server/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8080'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// قاعدة البيانات
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sulaf_pdf', {
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
    category: { type: String, required: true },
    subcategory: { type: String },
    tags: [{ type: String }],
    language: { type: String, default: 'ar' },
    fileUrl: { type: String, required: true },
    coverImage: { type: String, required: true },
    fileType: { type: String, enum: ['pdf', 'epub', 'txt', 'audio'], required: true },
    fileSize: { type: Number },
    pages: { type: Number },
    duration: { type: Number }, // للكتب الصوتية
    isFeatured: { type
