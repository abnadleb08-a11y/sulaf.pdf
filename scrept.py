# web-scraper/scraper.py
import requests
from bs4 import BeautifulSoup
import os
import json
from urllib.parse import urljoin, quote
import time

class ArabicBookScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        
    def search_noorbook(self, query):
        """بحث في مكتبة نور"""
        base_url = "https://www.noor-book.com"
        search_url = f"{base_url}/بحث/كتاب/{quote(query)}"
        
        try:
            response = self.session.get(search_url, timeout=10)
            soup = BeautifulSoup(response.content, 'html.parser')
            
            books = []
            for item in soup.select('.book'):
                title_elem = item.select_one('.book-title a')
                author_elem = item.select_one('.book-author')
                link_elem = item.select_one('a')
                cover_elem = item.select_one('img')
                
                if title_elem:
                    book = {
                        'title': title_elem.text.strip(),
                        'author': author_elem.text.strip() if author_elem else 'غير معروف',
                        'url': urljoin(base_url, link_elem['href']) if link_elem else None,
                        'cover': urljoin(base_url, cover_elem['src']) if cover_elem else None,
                        'source': 'مكتبة نور'
                    }
                    books.append(book)
            
            return books[:10]  # إرجاع أول 10 نتائج فقط
            
        except Exception as e:
            print(f"Error scraping NoorBook: {e}")
            return []
    
    def search_kutubpdf(self, query):
        """بحث في مكتبة الكتب"""
        base_url = "https://www.kutub-pdf.net"
        search_url = f"{base_url}/search?q={quote(query)}"
        
        try:
            response = self.session.get(search_url, timeout=10)
            soup = BeautifulSoup(response.content, 'html.parser')
            
            books = []
            for item in soup.select('.book-item'):
                title_elem = item.select_one('.book-title')
                author_elem = item.select_one('.book-author')
                link_elem = item.select_one('a')
                cover_elem = item.select_one('img')
                
                if title_elem:
                    book = {
                        'title': title_elem.text.strip(),
                        'author': author_elem.text.strip() if author_elem else 'غير معروف',
                        'url': urljoin(base_url, link_elem['href']) if link_elem else None,
                        'cover': urljoin(base_url, cover_elem['src']) if cover_elem else None,
                        'source': 'مكتبة الكتب'
                    }
                    books.append(book)
            
            return books[:10]
            
        except Exception as e:
            print(f"Error scraping KutubPDF: {e}")
            return []
    
    def search_arabic_books(self, query):
        """بحث في مواقع متعددة"""
        results = []
        
        # بحث في جميع المصادر
        sources = [
            self.search_noorbook,
            self.search_kutubpdf,
        ]
        
        for source in sources:
            try:
                books = source(query)
                results.extend(books)
                time.sleep(1)  # تأخير بين الطلبات
            except Exception as e:
                print(f"Error in source {source.__name__}: {e}")
                continue
        
        return results
    
    def download_book(self, url, save_path):
        """تحميل كتاب من رابط"""
        try:
            response = self.session.get(url, stream=True, timeout=30)
            
            if response.status_code == 200:
                with open(save_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                return True
            else:
                print(f"Failed to download: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"Error downloading book: {e}")
            return False

# استخدام السكريبت
if __name__ == "__main__":
    scraper = ArabicBookScraper()
    
    # بحث عن كتب
    query = input("أدخل مصطلح البحث: ")
    results = scraper.search_arabic_books(query)
    
    print(f"عدد النتائج: {len(results)}")
    for i, book in enumerate(results, 1):
        print(f"{i}. {book['title']} - {book['author']} ({book['source']})")
    
    # اختيار كتاب للتحميل
    if results:
        choice = int(input("اختر رقم الكتاب للتحميل: ")) - 1
        if 0 <= choice < len(results):
            selected_book = results[choice]
            
            # تحميل الكتاب
            filename = f"{selected_book['title'].replace('/', '_')}.pdf"
            save_path = os.path.join('downloads', filename)
            
            print(f"جاري تحميل: {selected_book['title']}")
            if scraper.download_book(selected_book['url'], save_path):
                print(f"تم التحميل بنجاح: {save_path}")
            else:
                print("فشل التحميل")
