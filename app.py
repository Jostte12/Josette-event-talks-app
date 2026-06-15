import re
import html as html_lib
import xml.etree.ElementTree as ET
import urllib.request
from flask import Flask, jsonify, render_template

app = Flask(__name__)

# Namespace map for Atom feed
namespaces = {'atom': 'http://www.w3.org/2005/Atom'}

def clean_html_to_text(html_content):
    # Convert links: <a href="url">text</a> -> text (url)
    text = re.sub(r'<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)</a>', r'\2 (\1)', html_content)
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Unescape HTML entities
    text = html_lib.unescape(text)
    # Normalize whitespaces
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def parse_updates(entry_title, content_html, link):
    # Regex to find <h3>Category</h3> content until the next <h3> or end of content
    pattern = re.compile(r'<h3>(.*?)</h3>(.*?)(?=<h3>|$)', re.DOTALL | re.IGNORECASE)
    matches = pattern.findall(content_html)
    
    updates = []
    if not matches:
        # Fallback if no <h3> found
        updates.append({
            'date': entry_title,
            'type': 'Update',
            'html': content_html,
            'text': clean_html_to_text(content_html),
            'link': link
        })
    else:
        for type_text, html_segment in matches:
            type_text = type_text.strip()
            html_segment = html_segment.strip()
            updates.append({
                'date': entry_title,
                'type': type_text,
                'html': html_segment,
                'text': clean_html_to_text(html_segment),
                'link': link
            })
            
    return updates

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    try:
        url = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            xml_data = response.read()
        
        root = ET.fromstring(xml_data)
        all_updates = []
        
        for entry in root.findall('atom:entry', namespaces):
            title = entry.find('atom:title', namespaces).text
            link_elem = entry.find("atom:link[@rel='alternate']", namespaces)
            link = link_elem.attrib.get('href') if link_elem is not None else ""
            content_elem = entry.find('atom:content', namespaces)
            content_html = content_elem.text if content_elem is not None else ""
            
            parsed_updates = parse_updates(title, content_html, link)
            all_updates.extend(parsed_updates)
            
        return jsonify({
            'success': True,
            'updates': all_updates
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
