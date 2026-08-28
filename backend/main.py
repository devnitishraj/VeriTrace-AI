from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from PIL import Image, ExifTags

from pathlib import Path
import hashlib
import tempfile
import os


app = FastAPI(
    title="VeriTrace AI",
    description="AI-Powered Digital Media Forensics",
    version="1.0.0"
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],

    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# SUPPORTED FILE TYPES
# =========================================================

IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".bmp",
    ".gif",
    ".tiff",
    ".tif"
}

VIDEO_EXTENSIONS = {
    ".mp4",
    ".mov",
    ".avi",
    ".mkv",
    ".webm",
    ".m4v",
    ".mpeg",
    ".mpg"
}


# =========================================================
# SHA-256
# =========================================================

def calculate_sha256(file_path):

    sha256 = hashlib.sha256()

    with open(file_path, "rb") as file:

        while True:

            chunk = file.read(1024 * 1024)

            if not chunk:
                break

            sha256.update(chunk)

    return sha256.hexdigest()


# =========================================================
# MEDIA TYPE
# =========================================================

def detect_media_type(filename, content_type=None):

    extension = Path(filename).suffix.lower()

    if extension in IMAGE_EXTENSIONS:
        return "image"

    if extension in VIDEO_EXTENSIONS:
        return "video"

    if content_type:

        if content_type.startswith("image/"):
            return "image"

        if content_type.startswith("video/"):
            return "video"

    return "unknown"


# =========================================================
# IMAGE ANALYSIS
# =========================================================

def analyze_image(file_path):

    result = {
        "format": None,
        "width": None,
        "height": None,
        "mode": None,
        "exif_found": False,
        "exif": {}
    }

    try:

        image = Image.open(file_path)

        result["format"] = image.format
        result["width"] = image.width
        result["height"] = image.height
        result["mode"] = image.mode

        exif_data = image.getexif()

        if exif_data:

            result["exif_found"] = True

            for key, value in exif_data.items():

                tag = ExifTags.TAGS.get(
                    key,
                    str(key)
                )

                result["exif"][tag] = str(value)

    except Exception as error:

        result["error"] = str(error)

    return result


# =========================================================
# VIDEO ANALYSIS
# =========================================================

def analyze_video(file_path):

    result = {
        "format": Path(file_path).suffix
        .replace(".", "")
        .upper(),

        "width": None,
        "height": None,
        "fps": None,
        "frame_count": None,
        "duration": None,
        "codec": None
    }

    try:

        import cv2

        video = cv2.VideoCapture(file_path)

        if video.isOpened():

            width = video.get(
                cv2.CAP_PROP_FRAME_WIDTH
            )

            height = video.get(
                cv2.CAP_PROP_FRAME_HEIGHT
            )

            fps = video.get(
                cv2.CAP_PROP_FPS
            )

            frame_count = video.get(
                cv2.CAP_PROP_FRAME_COUNT
            )

            result["width"] = int(width)
            result["height"] = int(height)

            if fps:
                result["fps"] = round(fps, 2)

            if frame_count:
                result["frame_count"] = int(
                    frame_count
                )

            if fps and frame_count:
                result["duration"] = round(
                    frame_count / fps,
                    2
                )

            video.release()

    except Exception as error:

        result["note"] = (
            "Basic video analysis available. "
            "OpenCV information unavailable."
        )

    return result


# =========================================================
# RISK CALCULATION
# =========================================================

def calculate_risk(
    media_type,
    file_size,
    exif_found
):

    score = 20

    if media_type == "image":

        if not exif_found:
            score += 15

        if file_size < 10 * 1024:
            score += 10

    elif media_type == "video":

        score += 5

    score = min(score, 100)

    if score >= 70:

        level = "High Risk - Requires Review"

    elif score >= 40:

        level = "Medium Risk - Requires Review"

    else:

        level = "Low Risk"

    return score, level


# =========================================================
# INDICATORS
# =========================================================

def create_indicators(
    media_type,
    exif_found,
    file_size
):

    indicators = []

    if media_type == "image":

        if exif_found:

            indicators.append({
                "severity": "positive",
                "message": "EXIF metadata detected."
            })

        else:

            indicators.append({
                "severity": "warning",
                "message": "No EXIF metadata found."
            })

        if file_size < 10 * 1024:

            indicators.append({
                "severity": "warning",
                "message": "Very small image file."
            })

    if media_type == "video":

        indicators.append({
            "severity": "positive",
            "message": "Video file successfully received."
        })

        indicators.append({
            "severity": "info",
            "message": "Video fingerprint generated successfully."
        })

    return indicators


# =========================================================
# ROOT
# =========================================================

@app.get("/")
def root():

    return {
        "status": "online",
        "service": "VeriTrace AI"
    }


# =========================================================
# HEALTH
# =========================================================

@app.get("/health")
def health():

    return {
        "status": "healthy"
    }


# =========================================================
# ANALYZE
# =========================================================

@app.post("/analyze")
async def analyze_media(
    file: UploadFile = File(...)
):

    if not file.filename:

        raise HTTPException(
            status_code=400,
            detail="No file selected."
        )

    media_type = detect_media_type(
        file.filename,
        file.content_type
    )

    if media_type == "unknown":

        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported file. "
                "Please upload an image or video."
            )
        )

    content = await file.read()

    if not content:

        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty."
        )

    # Maximum 100 MB
    MAX_SIZE = 100 * 1024 * 1024

    if len(content) > MAX_SIZE:

        raise HTTPException(
            status_code=413,
            detail="Maximum file size is 100 MB."
        )

    suffix = Path(
        file.filename
    ).suffix

    temporary_file = None

    try:

        # -------------------------------------------------
        # Temporary file
        # -------------------------------------------------

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix
        ) as temp:

            temp.write(content)

            temporary_file = temp.name

        # -------------------------------------------------
        # SHA-256
        # -------------------------------------------------

        sha256 = calculate_sha256(
            temporary_file
        )

        # -------------------------------------------------
        # Base information
        # -------------------------------------------------

        file_size = len(content)

        image_data = {}
        video_data = {}

        exif_found = False

        # -------------------------------------------------
        # IMAGE
        # -------------------------------------------------

        if media_type == "image":

            image_data = analyze_image(
                temporary_file
            )

            exif_found = image_data.get(
                "exif_found",
                False
            )

        # -------------------------------------------------
        # VIDEO
        # -------------------------------------------------

        if media_type == "video":

            video_data = analyze_video(
                temporary_file
            )

        # -------------------------------------------------
        # Risk
        # -------------------------------------------------

        risk_score, risk_level = calculate_risk(
            media_type,
            file_size,
            exif_found
        )

        # -------------------------------------------------
        # Indicators
        # -------------------------------------------------

        indicators = create_indicators(
            media_type,
            exif_found,
            file_size
        )

        # -------------------------------------------------
        # AI analysis
        # -------------------------------------------------

        ai_analysis = {

            "engine":
                "VeriTrace AI Forensic Engine",

            "risk_score":
                risk_score,

            "confidence":
                75,

            "verdict":
                risk_level,

            "media_type":
                media_type,

            "analysis_mode":
                "Digital Media Forensics"
        }

        # -------------------------------------------------
        # RESPONSE
        # -------------------------------------------------

        return {

            "success": True,

            "message":
                "Media analysis completed successfully.",

            "file": {

                "name":
                    file.filename,

                "filename":
                    file.filename,

                "type":
                    file.content_type,

                "media_type":
                    media_type,

                "size":
                    file_size,

                "size_kb":
                    round(
                        file_size / 1024,
                        2
                    )
            },

            "file_name":
                file.filename,

            "file_type":
                media_type,

            "file_size":
                file_size,

            "sha256":
                sha256,

            "image":
                image_data,

            "video":
                video_data,

            "metadata": {

                "file_name":
                    file.filename,

                "file_type":
                    file.content_type,

                "media_type":
                    media_type,

                "size":
                    file_size
            },

            "exif":
                image_data.get(
                    "exif",
                    {}
                ),

            "exif_found":
                exif_found,

            "indicators":
                indicators,

            "suspicious_indicators":
                indicators,

            "ai_analysis":
                ai_analysis,

            "risk_score":
                risk_score,

            "risk_level":
                risk_level
        }

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {error}"
        )

    finally:

        if (
            temporary_file
            and os.path.exists(temporary_file)
        ):

            try:
                os.remove(temporary_file)

            except Exception:
                pass


# =========================================================
# COMPATIBILITY ROUTE
# =========================================================

@app.post("/analyze_media")
async def analyze_media_old(
    file: UploadFile = File(...)
):

    return await analyze_media(file)