import os
from datetime import datetime

root_url = 'https://tobiasmue91.github.io/gptgames/'

def generate_sitemap():
    with open('index.html', 'r', encoding='utf-8') as f:
        content = f.read()

    urls = []
    start = 0
    while True:
        start = content.find('<a href="', start)
        if start == -1:
            break
        end = content.find('"', start+9)
        url = content[start+9:end]
        if not url.startswith('http'):
            urls.append(url)
        start = end

    with open('sitemap.xml', 'w', encoding='utf-8') as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        f.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
                'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
                'xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 '
                'http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">\n')
        for url in urls:
            lastmod = datetime.now().isoformat()
            priority = '0.80'
            if url == '':
                url = root_url
                priority = '1.00'
            f.write(f'  <url>\n'
                    f'    <loc>{root_url}{url}</loc>\n'
                    f'    <lastmod>{lastmod}</lastmod>\n'
                    f'    <priority>{priority}</priority>\n'
                    f'  </url>\n')
        f.write('</urlset>')

if __name__ == '__main__':
    generate_sitemap()