import { useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";

const MAX_FILE_SIZE = 100 * 1024 * 1024;

function formatBytes(bytes) {
  if (!bytes) return "0 KB";

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) {
    return "N/A";
  }

  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  return `${minutes}m ${remainingSeconds}s`;
}

function safeText(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "N/A";
  }

  const text = String(value);

  if (text.length > 220) {
    return `${text.substring(0, 220)}...`;
  }

  return text;
}

function App() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const [result, setResult] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [backendOnline, setBackendOnline] =
    useState(false);

  // =====================================================
  // CHECK BACKEND
  // =====================================================

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await fetch(
          `${API_URL}/health`
        );

        if (!response.ok) {
          throw new Error();
        }

        setBackendOnline(true);
      } catch {
        setBackendOnline(false);
      }
    };

    checkBackend();

    const interval = setInterval(
      checkBackend,
      10000
    );

    return () => clearInterval(interval);
  }, []);

  // =====================================================
  // PREVIEW URL
  // =====================================================

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }

    const url = URL.createObjectURL(file);

    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // =====================================================
  // FILE SELECT
  // =====================================================

  const handleFileChange = (event) => {
    const selectedFile =
      event.target.files?.[0];

    setError("");
    setResult(null);

    if (!selectedFile) {
      setFile(null);
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setFile(null);

      setError(
        "File is too large. Maximum allowed size is 100 MB."
      );

      event.target.value = "";
      return;
    }

    const isImage =
      selectedFile.type.startsWith("image/");

    const isVideo =
      selectedFile.type.startsWith("video/");

    if (!isImage && !isVideo) {
      setFile(null);

      setError(
        "Unsupported file. Please select an image or video."
      );

      event.target.value = "";
      return;
    }

    setFile(selectedFile);
  };

  // =====================================================
  // ANALYZE
  // =====================================================

  const analyzeMedia = async () => {
    if (!file) {
      setError(
        "Please select an image or video first."
      );

      return;
    }

    if (!backendOnline) {
      setError(
        "Backend is offline. Please start FastAPI on port 8000."
      );

      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();

      // IMPORTANT:
      // Backend expects UploadFile named "file"
      formData.append("file", file);

      const response = await fetch(
        `${API_URL}/analyze`,
        {
          method: "POST",
          body: formData,
        }
      );

      let data;

      try {
        data = await response.json();
      } catch {
        throw new Error(
          "Backend returned an invalid response."
        );
      }

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Media analysis failed."
        );
      }

      setResult(data);
    } catch (err) {
      console.error(err);

      if (
        err.message?.includes(
          "Failed to fetch"
        )
      ) {
        setBackendOnline(false);

        setError(
          "Cannot connect to backend. Make sure FastAPI is running on port 8000."
        );
      } else {
        setError(
          err.message ||
            "Something went wrong during analysis."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // RESET
  // =====================================================

  const resetAnalysis = () => {
    setFile(null);
    setPreviewUrl("");
    setResult(null);
    setError("");
    setLoading(false);
  };

  // =====================================================
  // RESULT DATA
  // =====================================================

  const riskScore =
    Number(result?.risk_score ?? 0);

  const riskLevel =
    result?.risk_level ||
    "Analysis unavailable";

  const mediaType =
    result?.file_type ||
    result?.file?.media_type ||
    "unknown";

  const imageData =
    result?.image || {};

  const videoData =
    result?.video || {};

  const exifData =
    result?.exif || {};

  const indicators =
    result?.indicators ||
    result?.suspicious_indicators ||
    [];

  const aiAnalysis =
    result?.ai_analysis || {};

  const riskClass =
    riskScore >= 70
      ? "high"
      : riskScore >= 40
      ? "medium"
      : "low";

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="app">

      {/* =================================================
          NAVBAR
      ================================================= */}

      <header className="navbar">

        <div className="brand">

          <div className="brand-logo">
            VT
          </div>

          <div className="brand-text">

            <h1>
              VeriTrace AI
            </h1>

            <span>
              DIGITAL MEDIA FORENSICS
            </span>

          </div>

        </div>

        <div className="system-status">

          <span
            className={
              backendOnline
                ? "status-dot online"
                : "status-dot offline"
            }
          />

          {backendOnline
            ? "System Online"
            : "Backend Offline"}

        </div>

      </header>

      <main className="container">

        {/* =================================================
            HERO
        ================================================= */}

        {!result && !loading && (

          <section className="hero">

            <div className="hero-badge">
              AI-POWERED VERIFICATION
            </div>

            <h2>
              Verify What You See.
              <br />

              <span>
                Trust What You Share.
              </span>

            </h2>

            <p>
              Analyze images and videos for
              digital media forensic signals,
              metadata, fingerprints and
              suspicious indicators.
            </p>

          </section>

        )}

        {/* =================================================
            UPLOAD
        ================================================= */}

        {!result && !loading && (

          <section className="upload-section">

            <div className="section-heading">

              <span className="section-number">
                01
              </span>

              <div>

                <h3>
                  Upload Media
                </h3>

                <p>
                  Select an image or video for
                  forensic analysis.
                </p>

              </div>

            </div>

            <label className="drop-zone">

              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleFileChange}
              />

              <div className="upload-icon">
                ↑
              </div>

              <strong>
                {file
                  ? file.name
                  : "Choose Image or Video"}
              </strong>

              <span>
                JPG · PNG · WEBP · BMP · GIF ·
                TIFF · MP4 · MOV · AVI · MKV ·
                WEBM
              </span>

              <small>
                Maximum file size: 100 MB
              </small>

            </label>

            {/* =================================================
                SELECTED FILE
            ================================================= */}

            {file && (

              <div className="selected-file">

                <div className="selected-file-info">

                  <span className="file-type-badge">
                    {file.type.startsWith(
                      "video/"
                    )
                      ? "VIDEO"
                      : "IMAGE"}
                  </span>

                  <div>

                    <strong>
                      {file.name}
                    </strong>

                    <p>
                      {file.type || "Unknown type"}
                      {" · "}
                      {formatBytes(file.size)}
                    </p>

                  </div>

                </div>

                <button
                  type="button"
                  className="remove-button"
                  onClick={resetAnalysis}
                >
                  Remove
                </button>

              </div>

            )}

            {/* =================================================
                PREVIEW
            ================================================= */}

            {file && previewUrl && (

              <div className="preview-card">

                <div className="preview-header">
                  MEDIA PREVIEW
                </div>

                {file.type.startsWith(
                  "video/"
                ) ? (

                  <video
                    className="media-preview"
                    src={previewUrl}
                    controls
                    playsInline
                  />

                ) : (

                  <img
                    className="media-preview"
                    src={previewUrl}
                    alt="Selected media preview"
                  />

                )}

              </div>

            )}

            {/* =================================================
                ERROR
            ================================================= */}

            {error && (

              <div className="error-box">
                <strong>
                  Analysis Error
                </strong>

                <span>
                  {error}
                </span>
              </div>

            )}

            {/* =================================================
                ANALYZE BUTTON
            ================================================= */}

            <button
              type="button"
              className="analyze-button"
              disabled={
                !file ||
                loading ||
                !backendOnline
              }
              onClick={analyzeMedia}
            >

              {loading ? (
                <>
                  <span className="spinner" />
                  ANALYZING...
                </>
              ) : (
                "ANALYZE MEDIA →"
              )}

            </button>

            {!backendOnline && (

              <p className="backend-warning">
                Start your FastAPI backend on
                port 8000 before analysis.
              </p>

            )}

          </section>

        )}

        {/* =================================================
            LOADING
        ================================================= */}

        {loading && (

          <section className="loading-section">

            <div className="loader" />

            <h2>
              Running Forensic Analysis
            </h2>

            <p>
              Inspecting your media file,
              calculating its fingerprint and
              extracting available forensic
              information...
            </p>

          </section>

        )}

        {/* =================================================
            REPORT
        ================================================= */}

        {result && !loading && (

          <section className="report-section">

            {/* =================================================
                REPORT HEADER
            ================================================= */}

            <div className="report-header">

              <div>

                <div className="hero-badge">
                  VERIFICATION REPORT
                </div>

                <h2>
                  Analysis Complete
                </h2>

                <p>
                  Forensic analysis results for
                  your uploaded {mediaType}.
                </p>

              </div>

              <button
                type="button"
                className="new-analysis-button"
                onClick={resetAnalysis}
              >
                + New Analysis
              </button>

            </div>

            {/* =================================================
                RISK
            ================================================= */}

            <div
              className={`risk-card ${riskClass}`}
            >

              <div>

                <span className="card-label">
                  VERIFICATION STATUS
                </span>

                <h3>
                  {riskLevel}
                </h3>

                <p>
                  Overall forensic risk
                  assessment.
                </p>

              </div>

              <div className="risk-score">

                <strong>
                  {riskScore}
                </strong>

                <span>
                  / 100
                </span>

              </div>

            </div>

            {/* =================================================
                FILE + MEDIA
            ================================================= */}

            <div className="two-column">

              {/* FILE */}

              <div className="data-card">

                <span className="section-number">
                  02
                </span>

                <span className="card-label">
                  FILE INFORMATION
                </span>

                <h3>
                  Media Details
                </h3>

                <div className="data-row">

                  <span>
                    File Name
                  </span>

                  <strong>
                    {safeText(
                      result.file?.name
                    )}
                  </strong>

                </div>

                <div className="data-row">

                  <span>
                    Media Type
                  </span>

                  <strong>
                    {mediaType.toUpperCase()}
                  </strong>

                </div>

                <div className="data-row">

                  <span>
                    MIME Type
                  </span>

                  <strong>
                    {safeText(
                      result.file?.type
                    )}
                  </strong>

                </div>

                <div className="data-row">

                  <span>
                    File Size
                  </span>

                  <strong>
                    {formatBytes(
                      result.file?.size
                    )}
                  </strong>

                </div>

              </div>

              {/* MEDIA */}

              <div className="data-card">

                <span className="section-number">
                  03
                </span>

                <span className="card-label">
                  MEDIA ANALYSIS
                </span>

                <h3>
                  Technical Properties
                </h3>

                {mediaType === "image" ? (

                  <>

                    <div className="data-row">

                      <span>
                        Format
                      </span>

                      <strong>
                        {safeText(
                          imageData.format
                        )}
                      </strong>

                    </div>

                    <div className="data-row">

                      <span>
                        Resolution
                      </span>

                      <strong>
                        {imageData.width &&
                        imageData.height
                          ? `${imageData.width} × ${imageData.height}`
                          : "N/A"}
                      </strong>

                    </div>

                    <div className="data-row">

                      <span>
                        Color Mode
                      </span>

                      <strong>
                        {safeText(
                          imageData.mode
                        )}
                      </strong>

                    </div>

                    <div className="data-row">

                      <span>
                        EXIF
                      </span>

                      <strong>
                        {result.exif_found
                          ? "Detected"
                          : "Not Found"}
                      </strong>

                    </div>

                  </>

                ) : (

                  <>

                    <div className="data-row">

                      <span>
                        Format
                      </span>

                      <strong>
                        {safeText(
                          videoData.format
                        )}
                      </strong>

                    </div>

                    <div className="data-row">

                      <span>
                        Resolution
                      </span>

                      <strong>
                        {videoData.width &&
                        videoData.height
                          ? `${videoData.width} × ${videoData.height}`
                          : "N/A"}
                      </strong>

                    </div>

                    <div className="data-row">

                      <span>
                        FPS
                      </span>

                      <strong>
                        {videoData.fps ?? "N/A"}
                      </strong>

                    </div>

                    <div className="data-row">

                      <span>
                        Duration
                      </span>

                      <strong>
                        {formatDuration(
                          videoData.duration
                        )}
                      </strong>

                    </div>

                    <div className="data-row">

                      <span>
                        Frames
                      </span>

                      <strong>
                        {videoData.frame_count ??
                          "N/A"}
                      </strong>

                    </div>

                  </>

                )}

              </div>

            </div>

            {/* =================================================
                SHA-256
            ================================================= */}

            <div className="data-card full-width">

              <span className="section-number">
                04
              </span>

              <span className="card-label">
                SHA-256 FINGERPRINT
              </span>

              <h3>
                Cryptographic File Identity
              </h3>

              <div className="hash-box">
                {result.sha256 || "N/A"}
              </div>

              <p className="card-description">
                Unique SHA-256 fingerprint
                generated from the uploaded
                media file.
              </p>

            </div>

            {/* =================================================
                EXIF
            ================================================= */}

            {mediaType === "image" && (

              <div className="two-column">

                <div className="data-card">

                  <span className="section-number">
                    05
                  </span>

                  <span className="card-label">
                    EXIF METADATA
                  </span>

                  <h3>
                    Metadata Inspection
                  </h3>

                  {result.exif_found &&
                  Object.keys(exifData).length >
                    0 ? (

                    <div className="exif-list">

                      {Object.entries(
                        exifData
                      ).map(
                        ([key, value]) => (

                          <div
                            className="exif-row"
                            key={key}
                          >

                            <span>
                              {key}
                            </span>

                            <strong>
                              {safeText(value)}
                            </strong>

                          </div>

                        )
                      )}

                    </div>

                  ) : (

                    <div className="empty-state">
                      No readable EXIF metadata
                      was found in this image.
                    </div>

                  )}

                </div>

                <div className="data-card">

                  <span className="section-number">
                    06
                  </span>

                  <span className="card-label">
                    SUSPICIOUS INDICATORS
                  </span>

                  <h3>
                    Review Findings
                  </h3>

                  <IndicatorList
                    indicators={indicators}
                  />

                </div>

              </div>

            )}

            {/* =================================================
                VIDEO INDICATORS
            ================================================= */}

            {mediaType === "video" && (

              <div className="data-card full-width">

                <span className="section-number">
                  05
                </span>

                <span className="card-label">
                  VIDEO FORENSIC INDICATORS
                </span>

                <h3>
                  Review Findings
                </h3>

                <IndicatorList
                  indicators={indicators}
                />

              </div>

            )}

            {/* =================================================
                AI ANALYSIS
            ================================================= */}

            <div className="data-card full-width">

              <span className="section-number">
                07
              </span>

              <span className="card-label">
                FORENSIC ENGINE
              </span>

              <h3>
                Analysis Details
              </h3>

              <div className="ai-grid">

                <div className="ai-item">

                  <span>
                    ENGINE
                  </span>

                  <strong>
                    {safeText(
                      aiAnalysis.engine
                    )}
                  </strong>

                </div>

                <div className="ai-item">

                  <span>
                    CONFIDENCE
                  </span>

                  <strong>
                    {aiAnalysis.confidence ??
                      0}
                    %
                  </strong>

                </div>

                <div className="ai-item">

                  <span>
                    MEDIA TYPE
                  </span>

                  <strong>
                    {safeText(
                      aiAnalysis.media_type
                    ).toUpperCase()}
                  </strong>

                </div>

                <div className="ai-item">

                  <span>
                    ANALYSIS MODE
                  </span>

                  <strong>
                    {safeText(
                      aiAnalysis.analysis_mode
                    )}
                  </strong>

                </div>

              </div>

              <div className="disclaimer">

                <span>
                  i
                </span>

                <p>
                  This result represents
                  forensic indicators generated
                  by the current VeriTrace
                  analysis engine. It should not
                  be presented as definitive proof
                  that media is authentic or
                  manipulated without a validated
                  deepfake detection model.
                </p>

              </div>

            </div>

            {/* =================================================
                FOOTER
            ================================================= */}

            <footer className="report-footer">

              <span>
                VeriTrace AI
              </span>

              <span>
                Digital Media Forensics
              </span>

              <span>
                SHA-256 Fingerprint Generated
              </span>

            </footer>

          </section>

        )}

      </main>

    </div>
  );
}


// =========================================================
// INDICATOR COMPONENT
// =========================================================

function IndicatorList({ indicators }) {
  if (!indicators?.length) {
    return (
      <div className="empty-state">
        No indicators were returned by
        the analysis engine.
      </div>
    );
  }

  return (
    <div className="indicator-list">

      {indicators.map(
        (indicator, index) => {

          const severity =
            indicator?.severity ||
            "info";

          const icon =
            severity === "positive"
              ? "✓"
              : severity === "warning"
              ? "!"
              : "i";

          return (
            <div
              className={`indicator ${severity}`}
              key={`${severity}-${index}`}
            >

              <span className="indicator-icon">
                {icon}
              </span>

              <span>
                {safeText(
                  indicator?.message
                )}
              </span>

            </div>
          );
        }
      )}

    </div>
  );
}

export default App;