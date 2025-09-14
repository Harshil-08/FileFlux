import sys
import os
import subprocess
from pdf2docx import Converter

def pdf_to_docx(pdf_file, docx_file):
    os.makedirs(os.path.dirname(docx_file), exist_ok=True)
    cv = Converter(pdf_file)
    cv.convert(docx_file, start=0, end=None)
    cv.close()

def docx_to_pdf(docx_file, pdf_file):
    outdir = os.path.dirname(pdf_file)
    os.makedirs(outdir, exist_ok=True)

    try:
        subprocess.run([
            "soffice",
            "--headless",
            "--convert-to", "pdf",
            "--outdir", outdir,
            docx_file
        ], check=True)
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"LibreOffice conversion failed: {e}")

    generated_name = os.path.splitext(os.path.basename(docx_file))[0] + ".pdf"
    generated_path = os.path.join(outdir, generated_name)
    if os.path.exists(generated_path):
        if generated_path != pdf_file:
            os.replace(generated_path, pdf_file)
    else:
        raise FileNotFoundError("Expected output PDF was not created")

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
