import { IoMdClose } from "react-icons/io";
import { useEffect, useRef, useState } from "react";

const SmallSpinner = () => (
  <div
    style={{
      width: 28,
      height: 28,
      borderRadius: "50%",
      border: "3px solid rgba(255,255,255,0.2)",
      borderTopColor: "white",
      animation: "spin 1s linear infinite",
    }}
  >
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const MediaModal = ({ isOpen, onClose, mediaUrl, mediaType, fileName }) => {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const blobUrlRef = useRef(null);

  // Detect mobile (basic check)
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mediaUrl) return;

    // 🟢 If mobile + pdf → directly download, don’t preview
    if (isMobile && mediaType === "pdf") {
      handleDownload();
      return;
    }

    setLoading(true);
    setError(false);
    setPreviewUrl(null);

    (async () => {
      try {
        if (mediaType === "pdf") {
          try {
            const res = await fetch(mediaUrl, { mode: "cors" });
            if (!res.ok) {
              console.error("Preview fetch failed: status", res.status);
              setError(true);
              setLoading(false);
              return;
            }

            const blob = await res.blob();
            if (!blob || blob.size === 0) {
              console.error("Preview blob empty");
              setError(true);
              setLoading(false);
              return;
            }

            const url = URL.createObjectURL(blob);
            blobUrlRef.current = url;
            setPreviewUrl(url);
          } catch (err) {
            console.error("Preview failed", err);
            setError(true);
            setLoading(false);
          }
          return;
        }
        if (mediaType === "office") {
          const encoded = encodeURIComponent(mediaUrl);
          setPreviewUrl(
            `https://docs.google.com/viewer?embedded=true&url=${encoded}`
          );
          return;
        }
        setPreviewUrl(mediaUrl);
      } catch (err) {
        console.error("Preview failed", err);
        setError(true);
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaUrl, mediaType]);

  const handleDownload = async () => {
    try {
      const res = await fetch(mediaUrl, { mode: "cors" });
      if (!res.ok) {
        console.error("download error", res.status);
        window.open(mediaUrl, "_blank");
        return;
      }

      const blob = await res.blob();
      if (!blob || blob.size === 0) {
        console.error("empty blob");
        window.open(mediaUrl, "_blank");
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    } catch (err) {
      console.error("download failed", err);
      window.open(mediaUrl, "_blank");
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "rgba(0,0,0,0.6)",
        zIndex: 3000,
        padding: 20,
      }}
    >
      <div
        style={{
          width: "85%",
          maxWidth: 1100,
          height: "85%",
          background: "#111",
          borderRadius: 8,
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "transparent",
            border: "none",
            color: "white",
            fontSize: 22,
            cursor: "pointer",
            zIndex: 20,
          }}
        >
          <IoMdClose />
        </button>

        {/* Loader - CENTERED */}
        {loading && !error && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 10,
            }}
          >
            <SmallSpinner />
          </div>
        )}

        {/* Content */}
        <div
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            position: "relative",
          }}
        >
          {!error && mediaType === "image" && previewUrl && (
            <img
              src={previewUrl}
              alt="media"
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
              }}
              onLoad={() => setLoading(false)}
              onError={() => setError(true)}
            />
          )}

          {!error && mediaType === "video" && previewUrl && (
            <video
              src={previewUrl}
              controls
              style={{ maxWidth: "100%", maxHeight: "100%" }}
              onLoadedData={() => setLoading(false)}
              onError={() => setError(true)}
            />
          )}

          {!error && mediaType === "audio" && previewUrl && (
            <audio
              src={previewUrl}
              controls
              style={{ width: "80%" }}
              onLoadedData={() => setLoading(false)}
              onError={() => setError(true)}
            />
          )}

          {!error &&
            (mediaType === "pdf" || mediaType === "office") &&
            previewUrl && (
              <iframe
                src={previewUrl}
                title="doc"
                style={{ width: "100%", height: "100%", border: "none" }}
                onLoad={() => setLoading(false)}
                onError={() => setError(true)}
              />
            )}

          {error && (
            <p style={{ color: "white", fontSize: 14 }}>
              Preview not available
            </p>
          )}
        </div>

        {/* Bottom action bar */}
        <div
          style={{
            padding: "12px",
            borderTop: "1px solid rgba(255,255,255,0.15)",
            textAlign: "center",
          }}
        >
          <button
            onClick={handleDownload}
            style={{
              padding: "8px 16px",
              background: "#1976d2",
              border: "none",
              borderRadius: 6,
              color: "white",
              cursor: "pointer",
            }}
          >
            Download {fileName ? `(${fileName})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MediaModal;