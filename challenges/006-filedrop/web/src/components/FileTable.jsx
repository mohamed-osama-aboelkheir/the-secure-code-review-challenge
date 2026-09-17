function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleString();
}

export default function FileTable({ files, onDownload, onDelete }) {
  if (!files.length) {
    return <p className="empty">Nothing stored yet. Your uploads will show up here.</p>;
  }

  return (
    <table className="table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Size</th>
          <th>Uploaded</th>
          <th aria-label="actions" />
        </tr>
      </thead>
      <tbody>
        {files.map((file) => (
          <tr key={file.name}>
            <td className="filename">{file.name}</td>
            <td>{formatSize(file.size)}</td>
            <td className="muted">{formatDate(file.uploadedAt)}</td>
            <td className="row-actions">
              <button type="button" className="button button--small" onClick={() => onDownload(file.name)}>
                Download
              </button>
              <button
                type="button"
                className="button button--small button--danger"
                onClick={() => onDelete(file.name)}
              >
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
