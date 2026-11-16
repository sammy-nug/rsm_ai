import {
  ChangeEvent,
  DragEvent,
  MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { predictImage, PredictionResponse } from "./services/api";

const CLASS_NAMES = ["cat", "dog", "neither"] as const;
const ACCEPTED_TYPES = ["image/jpeg", "image/png"];
const MAX_FILE_BYTES = 10 * 1024 * 1024;
type ClassName = (typeof CLASS_NAMES)[number];
type ConfusionMatrix = Record<ClassName, Record<ClassName, number>>;

function createMatrix(): ConfusionMatrix {
  return Object.fromEntries(
    CLASS_NAMES.map((actual) => [
      actual,
      Object.fromEntries(CLASS_NAMES.map((predicted) => [predicted, 0])),
    ]),
  ) as ConfusionMatrix;
}

function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const datasetInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [results, setResults] = useState<PredictionResponse[]>([]);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const [matrix, setMatrix] = useState<ConfusionMatrix | null>(null);
  const [matrixCount, setMatrixCount] = useState(0);
  const [isEvaluating, setIsEvaluating] = useState(false);

  useEffect(() => {
    datasetInputRef.current?.setAttribute("webkitdirectory", "");
    datasetInputRef.current?.setAttribute("directory", "");
  }, []);

  useEffect(() => {
    const sectionIds = ["home", "classes", "analyzer", "evaluation", "about"];
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleSection = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visibleSection) setActiveSection(visibleSection.target.id);
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 },
    );

    sectionIds.forEach((id) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });

    return () => observer.disconnect();
  }, []);

  const theme = isDarkMode ? "dark" : "light";

  function navigateToSection(
    event: ReactMouseEvent<HTMLAnchorElement>,
    sectionId: string,
  ) {
    event.preventDefault();
    setActiveSection(sectionId);
    window.history.pushState(null, "", `#${sectionId}`);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "instant" });
  }

  function chooseFiles(nextFiles: File[]) {
    setError("");
    setResults([]);
    const validFiles = nextFiles.filter((file) => {
      if (!ACCEPTED_TYPES.includes(file.type)) return false;
      return file.size <= MAX_FILE_BYTES;
    });

    if (validFiles.length !== nextFiles.length) {
      setError("Only JPG, JPEG, and PNG images smaller than 10 MB are supported.");
    }
    if (!validFiles.length) return;

    previews.forEach((preview) => URL.revokeObjectURL(preview));
    setFiles(validFiles);
    setPreviews(validFiles.map((file) => URL.createObjectURL(file)));
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    chooseFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    chooseFiles(Array.from(event.dataTransfer.files));
  }

  function removeFiles() {
    previews.forEach((preview) => URL.revokeObjectURL(preview));
    setFiles([]);
    setPreviews([]);
    setResults([]);
    setError("");
  }

  async function handleAnalyze() {
    if (!files.length) return;
    setError("");
    setResults([]);
    setIsLoading(true);
    try {
      setResults(await Promise.all(files.map((file) => predictImage(file))));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The images could not be analyzed.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDatasetChange(event: ChangeEvent<HTMLInputElement>) {
    const datasetFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    setError("");
    setMatrix(null);

    const labeledFiles = datasetFiles.filter((file) => {
      const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
      return (
        ACCEPTED_TYPES.includes(file.type) &&
        path &&
        CLASS_NAMES.includes(path.split("/")[0] as ClassName)
      );
    });
    if (!labeledFiles.length) {
      setError("Choose a folder containing cat, dog, and neither subfolders.");
      return;
    }

    setIsEvaluating(true);
    try {
      const predictions = await Promise.all(
        labeledFiles.map(async (file) => ({
          file,
          result: await predictImage(file),
        })),
      );
      const nextMatrix = createMatrix();
      predictions.forEach(({ file, result }) => {
        const path = (file as File & { webkitRelativePath: string }).webkitRelativePath;
        const actual = path.split("/")[0] as ClassName;
        const predicted = result.prediction as ClassName;
        nextMatrix[actual][predicted] += 1;
      });
      setMatrix(nextMatrix);
      setMatrixCount(predictions.length);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The labeled dataset could not be evaluated.",
      );
    } finally {
      setIsEvaluating(false);
    }
  }

  const aggregateResult = useMemo(() => {
    if (results.length !== 1) return null;
    return results[0];
  }, [results]);

  return (
    <div className="app-shell" data-theme={theme}>
      <aside className="sidebar">
        <a className="brand" href="#home" onClick={(event) => navigateToSection(event, "home")} aria-label="Cat, Dog, or Neither dashboard">
          <span className="brand-mark" aria-hidden="true">✳</span>
          <span className="brand-name">Critter<span>Scope</span></span>
        </a>
        <p className="sidebar-label">YOUR WORKSPACE</p>
        <nav className="sidebar-nav" aria-label="Dashboard navigation">
          <a className={`sidebar-link ${activeSection === "home" ? "is-active" : ""}`} href="#home" onClick={(event) => navigateToSection(event, "home")} aria-current={activeSection === "home" ? "page" : undefined}>
            <span className="sidebar-icon" aria-hidden="true">⌂</span>Dashboard
          </a>
          <a className={`sidebar-link ${activeSection === "classes" ? "is-active" : ""}`} href="#classes" onClick={(event) => navigateToSection(event, "classes")} aria-current={activeSection === "classes" ? "page" : undefined}>
            <span className="sidebar-icon" aria-hidden="true">▧</span>The three classes
          </a>
          <a className={`sidebar-link ${activeSection === "analyzer" ? "is-active" : ""}`} href="#analyzer" onClick={(event) => navigateToSection(event, "analyzer")} aria-current={activeSection === "analyzer" ? "page" : undefined}>
            <span className="sidebar-icon" aria-hidden="true">⌕</span>Classify an image
            <span className="sidebar-link-arrow" aria-hidden="true">↗</span>
          </a>
          <a className={`sidebar-link ${activeSection === "evaluation" ? "is-active" : ""}`} href="#evaluation" onClick={(event) => navigateToSection(event, "evaluation")} aria-current={activeSection === "evaluation" ? "page" : undefined}>
            <span className="sidebar-icon" aria-hidden="true">▤</span>Model insights
          </a>
          <a className={`sidebar-link ${activeSection === "about" ? "is-active" : ""}`} href="#about" onClick={(event) => navigateToSection(event, "about")} aria-current={activeSection === "about" ? "page" : undefined}>
            <span className="sidebar-icon" aria-hidden="true">ⓘ</span>About the project
          </a>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span className="tip-star" aria-hidden="true">✦</span>
            <p>Got a picture you&apos;re curious about?</p>
            <a href="#analyzer" onClick={(event) => navigateToSection(event, "analyzer")}>Let&apos;s find out <span aria-hidden="true">→</span></a>
          </div>
          <div className="sidebar-credit">
            <span className="credit-dot" />
            <span>Tech4Youth AI capstone</span>
          </div>
        </div>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <p className="topbar-kicker">YOUR LITTLE VISION LAB</p>
            <h2>Dashboard</h2>
          </div>
          <div className="topbar-actions">
            <span className="model-status"><span className="status-dot" aria-hidden="true" />Cat · Dog · Neither</span>
          <button
            className="theme-toggle"
            onClick={() => setIsDarkMode((current) => !current)}
            aria-label="Toggle dark mode"
            aria-pressed={isDarkMode}
          >
            <span aria-hidden="true">{isDarkMode ? "☀" : "☾"}</span>
            {isDarkMode ? "Light" : "Dark"}
          </button>
          </div>
        </header>

        <main className="dashboard-content">
          <section className="hero dashboard-hero" id="home">
            <div className="hero-copy">
              <p className="eyebrow"><span className="eyebrow-dot" /> A curious little image classifier</p>
              <h1>Cat, dog, <span>or the unexpected?</span></h1>
              <p className="hero-text">
                Meet your picture detective. Drop in a photo and see which of
                three friendly labels your image brings to the story.
              </p>
              <a className="button button-primary" href="#analyzer" onClick={(event) => navigateToSection(event, "analyzer")}>
                Let&apos;s identify something <span aria-hidden="true">↗</span>
              </a>
              <p className="hero-note"><span aria-hidden="true">✦</span> Your images, one thoughtful guess at a time</p>
            </div>
            <div className="hero-visual" aria-label="A preview of the three image categories">
              <div className="hero-photo-grid">
                <div className="hero-photo-tile hero-photo-main">
                  <img src="/class-gallery/cat.jpg" alt="Curious orange cat looking up" />
                  <span className="photo-label"><span>01</span> THE CURIOUS CAT</span>
                </div>
                <div className="hero-photo-tile hero-photo-small hero-dog-tile">
                  <img src="/class-gallery/dog.jpg" alt="Golden dog sitting outdoors" />
                  <span className="photo-label">GOOD DOG</span>
                </div>
                <div className="hero-photo-tile hero-photo-small hero-neither-tile">
                  <img src="/class-gallery/neither.jpg" alt="Mountain lake landscape" />
                  <span className="photo-label">SOMETHING ELSE</span>
                </div>
              </div>
              <div className="hero-sticker"><span>3</span><small>ways to<br />surprise us</small></div>
            </div>
          </section>

          <section className="classes-section" id="classes">
            <div className="section-heading">
              <div>
                <p className="eyebrow">A field guide to the possible</p>
                <h2>So, what might we find?</h2>
                <p>Three labels, countless pictures. Here&apos;s the cast of characters.</p>
              </div>
              <a className="text-link" href="#analyzer" onClick={(event) => navigateToSection(event, "analyzer")}>Try your own photo <span aria-hidden="true">↗</span></a>
            </div>
            <div className="class-grid">
              <article className="class-card class-cat">
                <div className="class-image">
                  <img src="/class-gallery/cat.jpg" alt="An orange cat looking up curiously" loading="lazy" />
                  <span className="class-index">01 / FELINE</span>
                </div>
                <div className="class-card-copy">
                  <div className="class-title-row"><h3>Cat</h3><span aria-hidden="true">↗</span></div>
                  <p>From sleepy loafs to full-on zoomies. If it looks like a feline, it&apos;s in.</p>
                  <a href="#analyzer" onClick={(event) => navigateToSection(event, "analyzer")}>Meet your match <span aria-hidden="true">→</span></a>
                </div>
              </article>
              <article className="class-card class-dog">
                <div className="class-image">
                  <img src="/class-gallery/dog.jpg" alt="A golden dog sitting with a flower outdoors" loading="lazy" />
                  <span className="class-index">02 / CANINE</span>
                </div>
                <div className="class-card-copy">
                  <div className="class-title-row"><h3>Dog</h3><span aria-hidden="true">↗</span></div>
                  <p>Big, small, floofy or not. We&apos;re looking for our four-legged friends.</p>
                  <a href="#analyzer" onClick={(event) => navigateToSection(event, "analyzer")}>Meet your match <span aria-hidden="true">→</span></a>
                </div>
              </article>
              <article className="class-card class-neither">
                <div className="class-image">
                  <img src="/class-gallery/neither.jpg" alt="A peaceful mountain lake and forest landscape" loading="lazy" />
                  <span className="class-index">03 / THE UNEXPECTED</span>
                </div>
                <div className="class-card-copy">
                  <div className="class-title-row"><h3>Neither</h3><span aria-hidden="true">✳</span></div>
                  <p>A beautiful landscape, a favorite mug, or anything that&apos;s not a cat or dog.</p>
                  <a href="#analyzer" onClick={(event) => navigateToSection(event, "analyzer")}>Meet your match <span aria-hidden="true">→</span></a>
                </div>
              </article>
            </div>
          </section>

        <section className="analyzer" id="analyzer">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Your turn</p>
              <h2>Let&apos;s meet your picture.</h2>
              <p>Choose a clear image and we&apos;ll see what the model notices.</p>
            </div>
            <span className="section-number">01 <span>/ 03</span></span>
          </div>

          <div className="workspace-card">
            {!files.length ? (
              <div
                className={`drop-zone ${isDragging ? "is-dragging" : ""}`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <div className="upload-icon" aria-hidden="true"><span>↑</span></div>
                <h3>Drop your pictures here</h3>
                <p>Drag and drop, or pick a picture from your device.</p>
                <button
                  className="button button-secondary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose pictures <span aria-hidden="true">↗</span>
                </button>
                <small>JPG or PNG · Up to 10 MB each</small>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                  multiple
                  onChange={handleFileChange}
                  hidden
                />
              </div>
            ) : (
              <div className="selected-image">
                <div className="preview-grid">
                  {previews.map((preview, index) => (
                    <img
                      key={preview}
                      src={preview}
                      alt={`Selected upload ${index + 1}`}
                    />
                  ))}
                </div>
                <div className="selected-details">
                  <p className="eyebrow">Ready to explore</p>
                  <h3>{files.length} image{files.length === 1 ? "" : "s"} ready</h3>
                  <p>Each picture gets its own result, so you can compare them one by one.</p>
                  <div className="action-row">
                    <button className="button button-primary" onClick={handleAnalyze} disabled={isLoading}>
                      {isLoading ? <><span className="spinner" /> Analyzing...</> : "Analyze images"}
                    </button>
                    <button className="button button-quiet" onClick={removeFiles} disabled={isLoading}>
                      Remove all
                    </button>
                  </div>
                </div>
              </div>
            )}
            {error && <div className="message message-error" role="alert">{error}</div>}
          </div>

          {aggregateResult && (
            <div className="result-card">
              <div className="result-image">
                <img src={previews[0]} alt="Analyzed upload" />
              </div>
              <ResultContent result={aggregateResult} onReset={removeFiles} />
            </div>
          )}

          {results.length > 1 && (
            <div className="batch-results">
              <div className="section-heading compact-heading">
                <div>
                  <p className="eyebrow">The whole gang</p>
                  <h2>{results.length} little discoveries</h2>
                  <p>Here&apos;s what the model spotted in each picture.</p>
                </div>
              </div>
              <div className="batch-grid">
                {results.map((result, index) => (
                  <article className="batch-card" key={`${files[index].name}-${index}`}>
                    <img src={previews[index]} alt={`Analyzed upload ${index + 1}`} />
                    <div>
                      <p>{files[index].name}</p>
                      <strong>{result.prediction}</strong>
                      <span>Top model score · {(result.scores[result.prediction] * 100).toFixed(1)}%</span>
                    </div>
                  </article>
                ))}
              </div>
              <button className="button button-secondary" onClick={removeFiles}>
                Analyze another set
              </button>
            </div>
          )}
        </section>

        <section className="matrix-section" id="evaluation">
          <div className="section-heading">
            <div>
              <p className="eyebrow">For the extra curious</p>
              <h2>How well does it guess?</h2>
              <p>Explore the model&apos;s test results, or try it against your own labeled pictures.</p>
            </div>
            <span className="section-number">02 <span>/ 03</span></span>
          </div>
          <div className="matrix-layout">
            <div className="info-card matrix-upload">
              <span className="card-kicker">YOUR OWN TEST SET</span>
              <h3>Bring your own examples</h3>
              <p>
                Select a folder containing subfolders named <strong>cat</strong>,{" "}
                <strong>dog</strong>, and <strong>neither</strong>. The folder
                names provide the true labels.
              </p>
              <button className="button button-secondary" onClick={() => datasetInputRef.current?.click()} disabled={isEvaluating}>
                {isEvaluating ? "Checking your pictures..." : "Choose a labeled folder"}
              </button>
              <input ref={datasetInputRef} type="file" multiple onChange={handleDatasetChange} hidden />
              {matrix && <p className="matrix-count">{matrixCount} labeled images evaluated.</p>}
            </div>
            <div className="info-card">
              <span className="card-kicker">FROM THE TRAINING NOTEBOOK</span>
              <h3>A peek at the test results</h3>
              <img className="matrix-image" src="/confusion_matrix.png" alt="Precomputed model confusion matrix" />
              <p className="score-note">Precomputed artifact from the training notebook.</p>
            </div>
          </div>
          {matrix && <MatrixTable matrix={matrix} />}
        </section>

        <section className="info-section" id="about">
          <div className="info-card">
            <span className="section-number">03 <span>/ 03</span></span>
            <p className="eyebrow">A little about this project</p>
            <h2>Made for curious minds.</h2>
            <p>
              Cat, Dog, or Neither is an image classification system created
              for the Tech4Youth AI Engineering Capstone. It analyzes uploaded
              images and returns one of three available classes: cat, dog, or neither.
            </p>
          </div>
          <div className="info-card" id="how-it-works">
            <p className="eyebrow">The short version</p>
            <h2>Three steps. One answer.</h2>
            <ol className="steps">
              <li><span>01</span><span className="step-copy"><strong>Pick a picture</strong><small>Choose one or a whole handful.</small></span></li>
              <li><span>02</span><span className="step-copy"><strong>Let the model look</strong><small>It checks for familiar visual patterns.</small></span></li>
              <li><span>03</span><span className="step-copy"><strong>See what it thinks</strong><small>Cat, dog, or neither. You decide.</small></span></li>
            </ol>
          </div>
        </section>
        </main>

      <footer className="site-footer">
        <a className="brand footer-brand" href="#home" onClick={(event) => navigateToSection(event, "home")}>
          <span className="brand-mark" aria-hidden="true">✳</span>
          <span className="brand-name">Critter<span>Scope</span></span>
        </a>
        <span>Built with curiosity for the Tech4Youth AI Engineering Capstone.</span>
      </footer>
      </div>
    </div>
  );
}

function ResultContent({
  result,
  onReset,
}: {
  result: PredictionResponse;
  onReset: () => void;
}) {
  return (
    <div className="result-content">
      <p className="eyebrow">Here&apos;s our best guess</p>
      <h2>{result.prediction}</h2>
      <p className="result-description">
        We think this picture looks like{" "}
        <strong>{result.prediction === "neither" ? "neither a cat nor a dog" : `a ${result.prediction}`}</strong>.
      </p>
      <p className="scores-heading">What the model considered</p>
      <div className="scores">
        {Object.entries(result.scores).map(([label, score]) => (
          <div className="score-row" key={label}>
            <div className="score-label">
              <span>{label}</span>
              <strong>{(score * 100).toFixed(1)}%</strong>
            </div>
            <div className="score-track">
              <div className={`score-fill ${label}`} style={{ width: `${score * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="score-note">
        These are the model&apos;s scores, not guarantees. AI can get things wrong, especially with unusual or unclear pictures.
      </p>
      <button className="button button-secondary" onClick={onReset}>Analyze another image</button>
    </div>
  );
}

function MatrixTable({ matrix }: { matrix: ConfusionMatrix }) {
  return (
    <div className="matrix-table-card">
      <h3>Calculated matrix</h3>
      <p>Rows are actual labels; columns are model predictions.</p>
      <table>
        <thead>
          <tr>
            <th>Actual / Predicted</th>
            {CLASS_NAMES.map((label) => <th key={label}>{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {CLASS_NAMES.map((actual) => (
            <tr key={actual}>
              <th>{actual}</th>
              {CLASS_NAMES.map((predicted) => <td key={predicted}>{matrix[actual][predicted]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
