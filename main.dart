// mobile-app/lib/main.dart
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:sulaf_pdf/screens/home_screen.dart';
import 'package:sulaf_pdf/screens/login_screen.dart';
import 'package:sulaf_pdf/screens/register_screen.dart';
import 'package:sulaf_pdf/screens/library_screen.dart';
import 'package:sulaf_pdf/screens/profile_screen.dart';
import 'package:sulaf_pdf/screens/ai_story_screen.dart';
import 'package:sulaf_pdf/screens/pdf_reader_screen.dart';
import 'package:sulaf_pdf/screens/search_screen.dart';
import 'package:sulaf_pdf/screens/book_detail_screen.dart';
import 'package:sulaf_pdf/screens/audio_player_screen.dart';
import 'package:sulaf_pdf/screens/ocr_screen.dart';
import 'package:sulaf_pdf/controllers/auth_controller.dart';
import 'package:sulaf_pdf/controllers/book_controller.dart';
import 'package:sulaf_pdf/utils/theme.dart';
import 'package:firebase_core/firebase_core.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  runApp(MyApp());
}

class MyApp extends StatelessWidget {
  final AuthController authController = Get.put(AuthController());
  final BookController bookController = Get.put(BookController());

  @override
  Widget build(BuildContext context) {
    return GetMaterialApp(
      title: 'سولف PDF',
      theme: lightTheme,
      darkTheme: darkTheme,
      themeMode: ThemeMode.light,
      locale: Locale('ar', 'SA'),
      fallbackLocale: Locale('ar', 'SA'),
      translations: AppTranslations(),
      debugShowCheckedModeBanner: false,
      initialRoute: '/',
      getPages: [
        GetPage(name: '/', page: () => HomeScreen()),
        GetPage(name: '/login', page: () => LoginScreen()),
        GetPage(name: '/register', page: () => RegisterScreen()),
        GetPage(name: '/library', page: () => LibraryScreen()),
        GetPage(name: '/profile', page: () => ProfileScreen()),
        GetPage(name: '/ai', page: () => AIStoryScreen()),
        GetPage(name: '/reader', page: () => PDFReaderScreen()),
        GetPage(name: '/search', page: () => SearchScreen()),
        GetPage(name: '/book', page: () => BookDetailScreen()),
        GetPage(name: '/audio', page: () => AudioPlayerScreen()),
        GetPage(name: '/ocr', page: () => OCRScreen()),
      ],
      home: FutureBuilder(
        future: authController.checkLoginStatus(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return SplashScreen();
          }
          return authController.isLoggedIn.value ? HomeScreen() : LoginScreen();
        },
      ),
    );
  }
}

class SplashScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.menu_book, size: 80, color: Colors.blue),
            SizedBox(height: 20),
            Text(
              'سولف PDF',
              style: TextStyle(
                fontSize: 32,
                fontWeight: FontWeight.bold,
                color: Colors.blue,
              ),
            ),
            SizedBox(height: 10),
            Text(
              'المكتبة الرقمية العربية',
              style: TextStyle(fontSize: 16, color: Colors.grey),
            ),
            SizedBox(height: 30),
            CircularProgressIndicator(),
          ],
        ),
      ),
    );
  }
}
