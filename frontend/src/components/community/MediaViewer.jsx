import React, { useMemo, useState } from "react";

export default function MediaViewer({ mediaUrls = [], videoUrls = [], pdfUrls = [] }) {
  const [modalItem, setModalItem] = useState(null);
  const hasMedia = useMemo(
    () => mediaUrls.length || videoUrls.length || pdfUrls.length,
    [mediaUrls, videoUrls, pdfUrls]
  );

  if (!hasMedia) return null;

  return (
    <>
      <div className="community-media-block">
        {mediaUrls.length ? (
          <div className="community-media-grid">
            {mediaUrls.map((url, idx) => (
              <button
                key={`${url}-${idx}`}
                type="button"
                className="community-image-tile"
                onClick={() => setModalItem({ type: "image", url })}
              >
                <img src={url} alt={`Post media ${idx + 1}`} />
              </button>
            ))}
          </div>
        ) : null}

        {videoUrls.length ? (
          <div className="community-video-list">
            {videoUrls.map((url, idx) => (
              <video key={`${url}-${idx}`} src={url} controls preload="metadata" />
            ))}
          </div>
        ) : null}

        {pdfUrls.length ? (
          <div className="community-pdf-list">
            {pdfUrls.map((pdf, idx) => (
              <a key={`${pdf.name}-${idx}`} href={pdf.url} target="_blank" rel="noreferrer" className="community-pdf-item">
                <span>PDF</span>
                <strong>{pdf.name || `document-${idx + 1}.pdf`}</strong>
              </a>
            ))}
          </div>
        ) : null}
      </div>

      {modalItem ? (
        <div className="community-modal-overlay" role="dialog" aria-modal="true" onClick={() => setModalItem(null)}>
          <div className="community-modal-card" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="community-modal-close" onClick={() => setModalItem(null)}>
              Close
            </button>
            {modalItem.type === "image" ? <img src={modalItem.url} alt="Expanded media" /> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
