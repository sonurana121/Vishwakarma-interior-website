from urllib.request import urlopen
from bs4 import BeautifulSoup
url = "https://books.toscrape.com/catalogue/page-1.html"
soup = BeautifulSoup(urlopen(url).read(), "html.parser")
for book in soup.select("article.product_pod h3 a"):
 print(book.get("title"))