from urllib.request import urlopen
from bs4 import BeautifulSoup
url = "https://books.toscrape.com/catalogue/page-1.html"
soup = BeautifulSoup(urlopen(url).read(), "html.parser")
for book in soup.select("article.product_pod"):
 title = book.h3.a.get("title")
 price = book.select_one(".price_color").get_text(strip=True)
 print(title, "->", price)