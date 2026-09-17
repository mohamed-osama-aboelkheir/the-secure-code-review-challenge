import { useCallback, useEffect, useRef, useState } from 'react';
import FileTable from '../components/FileTable.jsx';
import UsageBar from '../components/UsageBar.jsx';
import { api } from '../api.js';

export default function Dashboard({ user, onLogout }) {
  const [files, setFiles] = useState([]);
  const [usage, setUsage] = useState({ usedBytes: 0, quotaBytes: 0 });
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api.listFiles();
      setFiles(data.files);
      setUsage(data.usage);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const uploadFile = useCallback(
    async (file) => {
      if (!file) return;
      setUploading(true);
      setError('');
      try {
        const result = await api.uploadFile(file);
        setStatus(`Uploaded ${result.file.name}`);
        await refresh();
      } catch (err) {
        setError(err.message);
      } finally {
        setUploading(false);
      }
    },
    [refresh]
  );

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    uploadFile(event.dataTransfer.files[0]);
  }

  async function handleDelete(name) {
    try {
      await api.deleteFile(name);
      setStatus(`Deleted ${name}`);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDownload(name) {
    try {
      await api.downloadFile(name);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">◈</span>
          <span>FileDrop</span>
        </div>
        <div className="topbar-right">
          <span className="who">
            Signed in as <strong>{user.username}</strong>
          </span>
          <button type="button" className="button button--ghost" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </header>

      <main className="content">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Your drop</h2>
              <p className="muted">Files here are private to your account.</p>
            </div>
            <UsageBar usage={usage} />
          </div>

          <div
            className={dragging ? 'dropzone dropzone--active' : 'dropzone'}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click();
            }}
          >
            <input
              ref={inputRef}
              type="file"
              hidden
              onChange={(event) => {
                uploadFile(event.target.files[0]);
                event.target.value = '';
              }}
            />
            <p className="dropzone-title">{uploading ? 'Uploading…' : 'Drop a file here'}</p>
            <p className="muted">or click to browse — up to 10 MB per file</p>
          </div>

          {status && <p className="alert alert--ok">{status}</p>}
          {error && <p className="alert alert--error">{error}</p>}

          <FileTable files={files} onDownload={handleDownload} onDelete={handleDelete} />
        </section>
      </main>

      <footer className="footer">FileDrop · personal storage</footer>
    </div>
  );
}
