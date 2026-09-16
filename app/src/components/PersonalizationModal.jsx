import { useEffect, useState } from "react";
import { CheckIcon, CloseIcon, PersonalizeIcon } from "../icons";
import {
  fetchPersonalizationFiles,
  uploadPersonalizationFiles,
  deletePersonalizationFile,
  markPersonalizationComplete,
  unmarkPersonalizationComplete,
} from "../api/personalization";

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileExtension(name) {
  const dot = String(name || "").lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1, dot + 5).toUpperCase();
}

// Only image files get an actual visual preview — a .dxf or similar can't
// be rendered by the browser, so it falls back to an extension badge.
function FileThumb({ src, isImage, fileName }) {
  if (isImage && src) {
    return <img className="personalization-file-thumb" src={src} alt={fileName} />;
  }
  return (
    <div className="personalization-file-thumb placeholder">{fileExtension(fileName)}</div>
  );
}

// Opened from the personalization icon next to FulfillmentIcon in
// Orders.jsx, only for orders that contain a product the merchant marked as
// personalizable (Podešavanja → Alati → Personalizacija porudžbina). Lets
// the merchant attach the customer's personalization files (e.g. an
// engraving text file, a print image) to this specific order + product.
export default function PersonalizationModal({
  order,
  productId,
  connectionId,
  onClose,
  onStatusChange,
}) {
  const [existingFiles, setExistingFiles] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [pendingPreviews, setPendingPreviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);
  const [togglingCompleted, setTogglingCompleted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPersonalizationFiles(connectionId, order.id)
      .then((data) => {
        if (cancelled) return;
        setExistingFiles(data.files || []);
        setCompleted(Boolean(data.completed));
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [connectionId, order.id]);

  // Local object URLs so a picked-but-not-yet-saved image shows its actual
  // content immediately, not just a filename — revoked on cleanup so they
  // don't leak once superseded (a new pick) or the modal closes.
  useEffect(() => {
    const previews = pendingFiles.map((file) =>
      file.type.startsWith("image/") ? URL.createObjectURL(file) : null
    );
    setPendingPreviews(previews);
    return () => previews.forEach((url) => url && URL.revokeObjectURL(url));
  }, [pendingFiles]);

  const addFiles = (fileList) => {
    setPendingFiles((cur) => [...cur, ...Array.from(fileList)]);
  };

  const removePendingFile = (index) => {
    setPendingFiles((cur) => cur.filter((_, i) => i !== index));
  };

  const removeExistingFile = (fileId) => {
    deletePersonalizationFile(connectionId, order.id, fileId)
      .then(() => setExistingFiles((cur) => cur.filter((f) => f.id !== fileId)))
      .catch((err) => setError(err.message));
  };

  const toggleCompleted = () => {
    setTogglingCompleted(true);
    setError("");
    const action = completed
      ? unmarkPersonalizationComplete(connectionId, order.id)
      : markPersonalizationComplete(connectionId, order.id);
    action
      .then((data) => {
        setCompleted(data.completed);
        onStatusChange?.();
      })
      .catch((err) => setError(err.message))
      .finally(() => setTogglingCompleted(false));
  };

  const handleSave = async () => {
    if (pendingFiles.length === 0) return;
    setSaving(true);
    setError("");
    try {
      const files = await Promise.all(
        pendingFiles.map(async (file) => ({
          fileName: file.name,
          dataUrl: await readAsDataUrl(file),
        }))
      );
      const data = await uploadPersonalizationFiles(connectionId, order.id, productId, files);
      setExistingFiles((cur) => [...cur, ...(data.files || [])]);
      setPendingFiles([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card personalization-modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="Zatvori">
          <CloseIcon />
        </button>
        <h2 className="modal-title">Personalizacija porudžbine</h2>
        <p className="modal-subtitle">#{order.number || order.id}</p>

        {!loading && (
          <div className={"personalization-status-row" + (completed ? " done" : "")}>
            <span className="personalization-status-label">
              {completed ? (
                <>
                  <CheckIcon /> Izgravirano
                </>
              ) : (
                "Čeka na graviranje"
              )}
            </span>
            <button
              type="button"
              className="personalization-status-toggle"
              onClick={toggleCompleted}
              disabled={togglingCompleted || (!completed && existingFiles.length === 0)}
            >
              {completed ? "Vrati u čekanje" : "Označi kao izgravirano"}
            </button>
          </div>
        )}

        <div
          className={"personalization-dropzone" + (dragOver ? " drag-over" : "")}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
          }}
        >
          <PersonalizeIcon />
          <p>Prevuci fajlove ovde ili</p>
          <label className="personalization-browse-btn">
            Izaberi fajlove
            <input
              type="file"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {pendingFiles.length > 0 && (
          <ul className="personalization-file-list">
            {pendingFiles.map((file, i) => (
              <li className="personalization-file-item pending" key={`${file.name}-${i}`}>
                <FileThumb
                  src={pendingPreviews[i]}
                  isImage={file.type.startsWith("image/")}
                  fileName={file.name}
                />
                <span className="personalization-file-name">{file.name}</span>
                <span className="personalization-file-size">{formatSize(file.size)}</span>
                <button
                  type="button"
                  className="personalization-remove-file"
                  onClick={() => removePendingFile(i)}
                  aria-label="Ukloni"
                >
                  <CloseIcon />
                </button>
              </li>
            ))}
          </ul>
        )}

        {!loading && existingFiles.length > 0 && (
          <>
            <p className="settings-row-label personalization-saved-label">Sačuvani fajlovi</p>
            <ul className="personalization-file-list">
              {existingFiles.map((file) => {
                const isImage = (file.contentType || "").startsWith("image/");
                return (
                  <li className="personalization-file-item" key={file.id}>
                    {isImage && file.url ? (
                      <a href={file.url} target="_blank" rel="noreferrer">
                        <FileThumb src={file.url} isImage fileName={file.fileName} />
                      </a>
                    ) : (
                      <FileThumb fileName={file.fileName} />
                    )}
                    {file.url ? (
                      <a
                        className="personalization-file-name"
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {file.fileName}
                      </a>
                    ) : (
                      <span className="personalization-file-name">{file.fileName}</span>
                    )}
                    <span className="personalization-file-size">{formatSize(file.sizeBytes)}</span>
                    <button
                      type="button"
                      className="personalization-remove-file"
                      onClick={() => removeExistingFile(file.id)}
                      aria-label="Obriši"
                    >
                      <CloseIcon />
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {error && <div className="woo-error">{error}</div>}

        <button
          type="button"
          className="btn-save woo-submit"
          onClick={handleSave}
          disabled={saving || pendingFiles.length === 0}
        >
          {saving ? "Čuvanje…" : "Sačuvaj"}
        </button>
      </div>
    </div>
  );
}
