import streamlit as st
import requests

st.set_page_config(page_title="KUY JURNAL", page_icon="💛", layout="wide")

st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');

    body, .stApp {
        font-family: 'Inter', sans-serif;
        background-color: #FFFDE7;
    }

    .header-container {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 40px 20px;
        background-color: #FFFDE7;
        margin-bottom: 0;
    }

    .header-left, .header-right {
        flex: 1;
        display: flex;
    }

    .header-right {
        justify-content: flex-end;
    }

    .header-center {
        flex: 2;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 12px;
    }

    .header-logo {
        font-size: 42px;
    }

    .header-title {
        font-size: 42px;
        font-weight: 800;
        color: #333;
        margin: 0;
    }

    .back-btn {
        background-color: #FDD835;
        color: #333;
        padding: 12px 24px;
        border-radius: 30px;
        text-decoration: none;
        font-weight: 600;
        font-size: 16px;
        border: 2px solid #FBC02D;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(253, 216, 53, 0.3);
        display: inline-block;
    }

    .back-btn:hover {
        background-color: #FBC02D;
        box-shadow: 0 4px 12px rgba(253, 216, 53, 0.5);
    }

    .chat-badge {
        background-color: #FDD835;
        color: #333;
        padding: 12px 24px;
        border-radius: 30px;
        font-weight: 600;
        font-size: 16px;
        border: 2px solid #FBC02D;
        box-shadow: 0 2px 8px rgba(253, 216, 53, 0.3);
        display: inline-block;
    }

    .center-all {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        width: 100%;
    }

    .search-bar-wrapper {
        width: 80%;
        max-width: 800px;
        margin: 40px auto 20px auto;
    }

    .stTextInput > div > div > input {
        border-radius: 30px;
        border: 3px solid #FDD835;
        padding: 16px 28px;
        font-size: 18px;
        outline: none;
        width: 100%;
        background-color: white;
    }

    .stTextInput > div > div > input:focus {
        border-color: #FBC02D;
        box-shadow: 0 0 12px rgba(253, 216, 53, 0.4);
    }

    .search-btn-wrapper {
        margin: 20px auto 30px auto;
    }

    .stButton > button {
        background-color: #FDD835;
        color: #333;
        font-weight: 700;
        border: none;
        border-radius: 30px;
        padding: 14px 48px;
        font-size: 18px;
        box-shadow: 0 2px 8px rgba(253, 216, 53, 0.3);
    }

    .stButton > button:hover {
        background-color: #FBC02D;
        box-shadow: 0 4px 12px rgba(253, 216, 53, 0.5);
    }

    .filter-label {
        font-size: 18px;
        font-weight: 700;
        color: #333;
        margin: 10px 0 15px 0;
    }

    .filter-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 20px;
        margin-bottom: 30px;
    }

    div[data-testid='stNumberInput'] {
        width: 120px !important;
    }

    .stNumberInput > div > div > input {
        border-radius: 12px;
        border: 2px solid #FDD835;
        font-size: 16px;
        padding: 10px 14px;
        width: 100%;
    }

    .stToggle > div > div > label {
        font-size: 16px;
    }

    .card {
        background-color: white;
        border: 2px solid #FDD835;
        border-radius: 15px;
        padding: 15px;
        height: 220px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        box-shadow: 0 4px 6px rgba(0,0,0,0.05);
        transition: transform 0.2s;
        overflow: hidden;
    }

    .card:hover {
        transform: translateY(-5px);
        box-shadow: 0 8px 12px rgba(0,0,0,0.1);
    }

    .card-title {
        font-weight: 700;
        font-size: 1em;
        color: #333;
        margin-bottom: 8px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        line-height: 1.4;
    }

    .card-meta {
        font-size: 0.85em;
        color: #666;
        margin-bottom: 6px;
    }

    .download-btn {
        background-color: #FDD835;
        color: #333;
        text-align: center;
        padding: 10px;
        border-radius: 8px;
        text-decoration: none;
        font-weight: 600;
        display: block;
        margin-top: auto;
        transition: background-color 0.2s;
    }

    .download-btn:hover {
        background-color: #FBC02D;
    }

    .download-btn.disabled {
        background-color: #E0E0E0;
        color: #999;
        cursor: not-allowed;
    }

    .footer {
        text-align: center;
        padding: 20px;
        margin-top: 40px;
        color: #666;
        font-size: 0.9em;
        border-top: 1px solid #FDD835;
    }
</style>
""", unsafe_allow_html=True)

col_left, col_center, col_right = st.columns([1, 2, 1])

with col_left:
    # Pakai link_button asli Streamlit biar pasti bisa diklik
    st.markdown('<div style="padding: 35px 0 0 20px;">', unsafe_allow_html=True)
    st.link_button("← Balik ke Chat", "https://bestienugas.vercel.app")
    st.markdown('</div>', unsafe_allow_html=True)

with col_center:
    st.markdown("""
    <div style="display: flex; justify-content: center; align-items: center; gap: 12px; padding: 40px 0;">
        <span style="font-size: 42px;">💛</span>
        <span style="font-size: 42px; font-weight: 800; color: #333;">KUY JURNAL</span>
    </div>
    """, unsafe_allow_html=True)

with col_right:
    st.markdown("""
    <div style="display: flex; justify-content: flex-end; padding: 45px 20px 0 0;">
        <div class="chat-badge">Ini Versi Trial</div>
    </div>
    """, unsafe_allow_html=True)

st.markdown('<div class="center-all">', unsafe_allow_html=True)

st.markdown('<div class="search-bar-wrapper">', unsafe_allow_html=True)
query = st.text_input("", placeholder="Cari jurnal apa Bestie?", key="search_input", label_visibility="collapsed")
st.markdown('</div>', unsafe_allow_html=True)

col_btn1, col_btn2, col_btn3 = st.columns([1, 1, 1])
with col_btn2:
    search_clicked = st.button("🔍 Search Journals", use_container_width=True)

st.markdown('<div style="text-align: center; font-size: 18px; font-weight: 700; color: #333; margin: 20px 0;">Filter Pencarian:</div>', unsafe_allow_html=True)
col_spacer1, col_year, col_toggle, col_spacer2 = st.columns([2, 1, 1, 2])

with col_year:
    st.markdown('<div style="margin-top: -5px;">', unsafe_allow_html=True)
    min_year = st.number_input(
        "Tahun Minimal", 
        min_value=1800, 
        max_value=2026, 
        value=2010, 
        key="min_year",
        label_visibility="collapsed" # Tambahkan ini agar terminal tidak warning
    )
    st.markdown('</div>', unsafe_allow_html=True)

with col_toggle:
    
    st.markdown('<div style="padding-top: 28px;">', unsafe_allow_html=True)
    open_access_only = st.toggle("Hanya PDF Gratis", key="open_access")
    st.markdown('</div>', unsafe_allow_html=True)

st.markdown('</div>', unsafe_allow_html=True) # Tutup center-all


if search_clicked:
    if not query:
        st.warning("Pliz masukin kata pencarian dulu, Bestie!")
    else:
        with st.spinner("Lagi nyari journal buat kamu..."):
            try:
                base_url = "https://api.openalex.org/works"
                filter_str = f"publication_year:{min_year}-"
                if open_access_only:
                    filter_str += ",is_oa:true"

                params = {
                    "search": query,
                    "filter": filter_str,
                    "per_page": 18
                }

                response = requests.get(base_url, params=params, timeout=10)
                response.raise_for_status()
                data = response.json()

                results = data.get("results", [])

                if not results:
                    st.info("Gaada hasil, cari kata kunci lain Bestie!")
                else:
                    st.success(f"Ketemu {len(results)} jurnal!")
                    
                    for i in range(0, len(results), 3):
                        cols = st.columns(3)
                        for j in range(3):
                            if i + j < len(results):
                                paper = results[i + j]
                                title = paper.get("title", "No Title")
                                author_list = paper.get("authorships", [])
                                first_author = author_list[0]["author"]["display_name"] if author_list else "Unknown Author"
                                pub_year = paper.get("publication_year", "N/A")
                                
                                pdf_url = None
                                
                                if paper.get("open_access", {}).get("oa_url"):
                                    pdf_url = paper["open_access"]["oa_url"]
                                
                                for loc in paper.get("locations", []):
                                    if loc.get("pdf_url"):
                                        pdf_url = loc["pdf_url"]
                                        break
                                
                                if not pdf_url:
                                    best_oa = paper.get("best_oa_url")
                                    if best_oa:
                                        pdf_url = best_oa

                                with cols[j]:
                                    card_html = f"""
                                    <div class="card">
                                        <div>
                                            <div class="card-title">{title}</div>
                                            <div class="card-meta">👤 {first_author}</div>
                                            <div class="card-meta">📅 {pub_year}</div>
                                        </div>
                                    """
                                    
                                    if pdf_url:
                                        card_html += f'<a href="{pdf_url}" target="_blank" class="download-btn">AMBIL PDF SEKARANG</a>'
                                    else:
                                        card_html += '<div class="download-btn disabled">PDF Berbayar</div>'
                                    
                                    card_html += "</div>"
                                    st.markdown(card_html, unsafe_allow_html=True)

            except requests.exceptions.ConnectionError:
                st.error("Failed to connect to the API. Check your internet connection.")
            except requests.exceptions.Timeout:
                st.error("Request timed out. Please try again.")
            except requests.exceptions.RequestException as e:
                st.error(f"An error occurred: {e}")

st.markdown("""
<div class="footer">
    Kuy Jurnal from Bestie Nugas 💛
</div>
""", unsafe_allow_html=True)
