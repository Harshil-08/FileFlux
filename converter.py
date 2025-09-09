import sys
from pdf2docx import Converter  # pip install pdf2docx
from docx2pdf import convert    # pip install docx2pdf

def pdf_to_docx(pdf_file, docx_file):
    cv = Converter(pdf_file)
    cv.convert(docx_file, start=0, end=None)
    cv.close()

def docx_to_pdf(docx_file, pdf_file):
    convert(docx_file, pdf_file)

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python converter.py [pdf2docx|docx2pdf] input_file output_file")
        sys.exit(1)
    
    mode = sys.argv[1].lower()
    input_file = sys.argv[2]
    output_file = sys.argv[3]

    try:
        if mode == "pdf2docx":
            pdf_to_docx(input_file, output_file)
        elif mode == "docx2pdf":
            docx_to_pdf(input_file, output_file)
        else:
            print("ERROR: Invalid mode. Use pdf2docx or docx2pdf")
            sys.exit(1)
        print("SUCCESS")
    except Exception as e:
        print("ERROR:", str(e))
        sys.exit(1)
