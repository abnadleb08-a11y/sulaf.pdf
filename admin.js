// admin-panel/src/App.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  Card,
  CardContent,
  LinearProgress,
  Box,
  Chip,
  MenuItem,
  Select,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  Add as AddIcon,
  CloudDownload as DownloadIcon,
  Visibility as ViewIcon,
  BarChart as ChartIcon,
  People as PeopleIcon,
  Book as BookIcon
} from '@mui/icons-material';

const API_URL = 'http://localhost:3000/api';

function App() {
  const [books, setBooks] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    description: '',
    category: 'رواية',
    language: 'ar',
    isFree: 'true',
    price: '0'
  });
  const [bookFile, setBookFile] = useState(null);
  const [coverImage, setCoverImage] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [booksRes, usersRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/admin/books`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
        }),
        axios.get(`${API_URL}/admin/users`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
        }),
        axios.get(`${API_URL}/admin/stats`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
        })
      ]);

      setBooks(booksRes.data.books || booksRes.data);
      setUsers(usersRes.data.users || usersRes.data);
      setStats(statsRes.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const formDataToSend = new FormData();
    Object.keys(formData).forEach(key => {
      formDataToSend.append(key, formData[key]);
    });
    
    if (bookFile) {
      formDataToSend.append('bookFile', bookFile);
    }
    
    if (coverImage) {
      formDataToSend.append('coverImage', coverImage);
    }

    try {
      const url = selectedBook 
        ? `${API_URL}/admin/books/${selectedBook._id}`
        : `${API_URL}/admin/books`;
      
      const method = selectedBook ? 'put' : 'post';
      
      await axios[method](url, formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${localStorage.getItem('adminToken')}`
        }
      });

      setSnackbar({
        open: true,
        message: selectedBook ? 'تم تحديث الكتاب بنجاح' : 'تم إضافة الكتاب بنجاح',
        severity: 'success'
      });
      
      setOpenDialog(false);
      resetForm();
      fetchData();
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'حدث خطأ أثناء حفظ الكتاب',
        severity: 'error'
      });
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API_URL}/admin/books/${selectedBook._id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
      });

      setSnackbar({
        open: true,
        message: 'تم حذف الكتاب بنجاح',
        severity: 'success'
      });
      
      setOpenDeleteDialog(false);
      fetchData();
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'حدث خطأ أثناء حذف الكتاب',
        severity: 'error'
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      author: '',
      description: '',
      category: 'رواية',
      language: 'ar',
      isFree: 'true',
      price: '0'
    });
    setBookFile(null);
    setCoverImage(null);
    setSelectedBook(null);
  };

  const openEditDialog = (book) => {
    setSelectedBook(book);
    setFormData({
      title: book.title,
      author: book.author,
      description: book.description || '',
      category: book.category,
      language: book.language,
      isFree: book.isFree ? 'true' : 'false',
      price: book.price.toString()
    });
    setOpenDialog(true);
  };

  const openAddDialog = () => {
    resetForm();
    setOpenDialog(true);
  };

  if (loading) {
    return (
      <Container sx={{ mt: 4 }}>
        <LinearProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Grid container spacing={3}>
        {/* الإحصائيات */}
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                إجمالي الكتب
              </Typography>
              <Typography variant="h4">
                {stats.totalBooks || 0}
              </Typography>
              <BookIcon sx={{ fontSize: 40, color: 'primary.main', mt: 1 }} />
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                إجمالي المستخدمين
              </Typography>
              <Typography variant="h4">
                {stats.totalUsers || 0}
              </Typography>
              <PeopleIcon sx={{ fontSize: 40, color: 'success.main', mt: 1 }} />
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                إجمالي التحميلات
              </Typography>
              <Typography variant="h4">
                {stats.totalDownloads || 0}
              </Typography>
              <DownloadIcon sx={{ fontSize: 40, color: 'warning.main', mt: 1 }} />
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                الكتب المميزة
              </Typography>
              <Typography variant="h4">
                {books.filter(b => b.isFeatured).length}
              </Typography>
              <ChartIcon sx={{ fontSize: 40, color: 'error.main', mt: 1 }} />
            </CardContent>
          </Card>
        </Grid>

        {/* أزرار التحكم */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h4">
              إدارة الكتب
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openAddDialog}
            >
              إضافة كتاب جديد
            </Button>
          </Box>
        </Grid>

        {/* جدول الكتب */}
        <Grid item xs={12}>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>الغلاف</TableCell>
                  <TableCell>العنوان</TableCell>
                  <TableCell>المؤلف</TableCell>
                  <TableCell>التصنيف</TableCell>
                  <TableCell>النوع</TableCell>
                  <TableCell>المشاهدات</TableCell>
                  <TableCell>التحميلات</TableCell>
                  <TableCell>الإجراءات</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {books.map((book) => (
                  <TableRow key={book._id}>
                    <TableCell>
                      <img
                        src={`http://localhost:3000${book.coverImage}`}
                        alt={book.title}
                        style={{ width: 50, height: 70, objectFit: 'cover' }}
                      />
                    </TableCell>
                    <TableCell>{book.title}</TableCell>
                    <TableCell>{book.author}</TableCell>
                    <TableCell>
                      <Chip label={book.category} size="small" />
                    </TableCell>
                    <TableCell>{book.fileType}</TableCell>
                    <TableCell>{book.views}</TableCell>
                    <TableCell>{book.downloads}</TableCell>
                    <TableCell>
                      <IconButton
                        color="primary"
                        onClick={() => openEditDialog(book)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        color="error"
                        onClick={() => {
                          setSelectedBook(book);
                          setOpenDeleteDialog(true);
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                      <IconButton
                        color="info"
                        onClick={() => window.open(`http://localhost:3000${book.fileUrl}`, '_blank')}
                      >
                        <ViewIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>

        {/* جدول المستخدمين */}
        <Grid item xs={12}>
          <Typography variant="h5" sx={{ mt: 4, mb: 2 }}>
            المستخدمون
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>الصورة</TableCell>
                  <TableCell>اسم المستخدم</TableCell>
                  <TableCell>البريد الإلكتروني</TableCell>
                  <TableCell>الاسم الكامل</TableCell>
                  <TableCell>عدد الكتب المقروءة</TableCell>
                  <TableCell>تاريخ التسجيل</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user._id}>
                    <TableCell>
                      <img
                        src={user.avatar}
                        alt={user.username}
                        style={{ width: 40, height: 40, borderRadius: '50%' }}
                      />
                    </TableCell>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.fullName || 'غير محدد'}</TableCell>
                    <TableCell>{user.stats?.totalBooksRead || 0}</TableCell>
                    <TableCell>
                      {new Date(user.createdAt).toLocaleDateString('ar-SA')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>
      </Grid>

      {/* ديالوج إضافة/تعديل كتاب */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedBook ? 'تعديل الكتاب' : 'إضافة كتاب جديد'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="عنوان الكتاب"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="اسم المؤلف"
                  value={formData.author}
                  onChange={(e) => setFormData({...formData, author: e.target.value})}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="وصف الكتاب"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  multiline
                  rows={3}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>التصنيف</InputLabel>
                  <Select
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    label="التصنيف"
                  >
                    <MenuItem value="رواية">رواية</MenuItem>
                    <MenuItem value="قصة">قصة</MenuItem>
                    <MenuItem value="شعر">شعر</MenuItem>
                    <MenuItem value="ديني">ديني</MenuItem>
                    <MenuItem value="تاريخي">تاريخي</MenuItem>
                    <MenuItem value="علمي">علمي</MenuItem>
                    <MenuItem value="تطوير ذات">تطوير ذات</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>اللغة</InputLabel>
                  <Select
                    value={formData.language}
                    onChange={(e) => setFormData({...formData, language: e.target.value})}
                    label="اللغة"
                  >
                    <MenuItem value="ar">العربية</MenuItem>
                    <MenuItem value="en">الإنجليزية</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>النوع</InputLabel>
                  <Select
                    value={formData.isFree}
                    onChange={(e) => setFormData({...formData, isFree: e.target.value})}
                    label="النوع"
                  >
                    <MenuItem value="true">مجاني</MenuItem>
                    <MenuItem value="false">مدفوع</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              {formData.isFree === 'false' && (
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="السعر"
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: e.target.value})}
                  />
                </Grid>
              )}
              <Grid item xs={12} md={6}>
                <Button
                  variant="outlined"
                  component="label"
                  fullWidth
                >
                  {bookFile ? bookFile.name : 'اختر ملف الكتاب'}
                  <input
                    type="file"
                    hidden
                    accept=".pdf,.epub,.txt,.doc,.docx"
                    onChange={(e) => setBookFile(e.target.files[0])}
                  />
                </Button>
              </Grid>
              <Grid item xs={12} md={6}>
                <Button
                  variant="outlined"
                  component="label"
                  fullWidth
                >
                  {coverImage ? coverImage.name : 'اختر صورة الغلاف'}
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={(e) => setCoverImage(e.target.files[0])}
                  />
                </Button>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>إلغاء</Button>
            <Button type="submit" variant="contained">
              {selectedBook ? 'تحديث' : 'إضافة'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ديالوج تأكيد الحذف */}
      <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
        <DialogTitle>تأكيد الحذف</DialogTitle>
        <DialogContent>
          <Typography>
            هل أنت متأكد من حذف الكتاب "{selectedBook?.title}"؟
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)}>إلغاء</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            حذف
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar للإشعارات */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({...snackbar, open: false})}
      >
        <Alert
          onClose={() => setSnackbar({...snackbar, open: false})}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}

export default App;
