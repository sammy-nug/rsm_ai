from pathlib import Path

import streamlit as st

from utils.prediction import PredictionError, load_saved_model, predict_image_bytes


PROJECT_ROOT = Path(__file__).resolve().parent
MODEL_PATH = PROJECT_ROOT / "model" / "cat_dog_neither_model.keras"

st.set_page_config(
    page_title="Cat, Dog, or Neither",
    page_icon="🐾",
    layout="centered",
)

dark_mode = st.sidebar.toggle("Dark mode", value=False)
theme = {
    "background": "#111827" if dark_mode else "#f7f9fc",
    "text": "#f3f4f6" if dark_mode else "#162033",
    "muted": "#aab4c5" if dark_mode else "#5d687b",
    "card": "#1f2937" if dark_mode else "#ffffff",
    "border": "#374151" if dark_mode else "#e6eaf2",
    "shadow": "rgba(0, 0, 0, 0.24)" if dark_mode else "rgba(27, 39, 68, 0.08)",
}

st.markdown(
    """
    <style>
    :root {
        --app-background: APP_BACKGROUND;
        --app-text: APP_TEXT;
        --app-muted: APP_MUTED;
        --app-card: APP_CARD;
        --app-border: APP_BORDER;
        --app-shadow: APP_SHADOW;
    }
    .stApp {
        background: var(--app-background);
    }
    .hero {
        padding: 2rem 0 1rem;
    }
    .eyebrow {
        color: #536dfe;
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
    }
    .hero h1 {
        color: var(--app-text);
        font-size: clamp(2.2rem, 7vw, 4rem);
        line-height: 1.05;
        margin: 0.35rem 0 0.8rem;
    }
    .hero p {
        color: var(--app-muted);
        font-size: 1.08rem;
        max-width: 42rem;
    }
    .result-card {
        background: var(--app-card);
        border: 1px solid var(--app-border);
        border-radius: 20px;
        box-shadow: 0 12px 30px var(--app-shadow);
        margin-top: 1.5rem;
        padding: 1.5rem;
        text-align: center;
    }
    .result-label {
        color: var(--app-muted);
        font-size: 0.85rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }
    .result-value {
        color: var(--app-text);
        font-size: 2.4rem;
        font-weight: 800;
        margin: 0.3rem 0;
    }
    .result-copy {
        color: var(--app-muted);
        margin: 0;
    }
    [data-testid="stFileUploaderDropzone"] {
        background: var(--app-card);
        border-color: var(--app-border);
    }
    [data-testid="stSidebar"] {
        background: var(--app-card);
    }
    [data-testid="stSidebar"] * {
        color: var(--app-text);
    }
    </style>
    """
    .replace("APP_BACKGROUND", theme["background"])
    .replace("APP_TEXT", theme["text"])
    .replace("APP_MUTED", theme["muted"])
    .replace("APP_CARD", theme["card"])
    .replace("APP_BORDER", theme["border"])
    .replace("APP_SHADOW", theme["shadow"]),
    unsafe_allow_html=True,
)

st.markdown(
    """
    <div class="hero">
        <div class="eyebrow">Tech4Youth AI Engineering Capstone</div>
        <h1>Cat, Dog, or Neither</h1>
        <p>AI-Powered Image Recognition System</p>
        <p>Upload an image and let the trained vision model identify whether it
        contains a cat, a dog, or neither.</p>
    </div>
    """,
    unsafe_allow_html=True,
)

if not MODEL_PATH.is_file():
    st.error(
        f"Model file not found at `{MODEL_PATH}`. "
        "Place cat_dog_neither_model.keras in the model folder."
    )
    st.stop()


@st.cache_resource
def get_model():
    try:
        return load_saved_model(MODEL_PATH)
    except (OSError, RuntimeError, ValueError) as exc:
        raise PredictionError("The trained model could not be loaded.") from exc


try:
    model = get_model()
except PredictionError as exc:
    st.error(str(exc))
    st.stop()

uploaded_file = st.file_uploader(
    "Upload an image",
    type=["jpg", "jpeg", "png"],
    help="Supported formats: JPG, JPEG, and PNG.",
)

if uploaded_file is not None:
    preview_column, details_column = st.columns([1.15, 1], gap="large")
    with preview_column:
        st.image(uploaded_file, caption=uploaded_file.name, use_container_width=True)
    with details_column:
        st.markdown("#### Ready to analyze")
        st.caption("The image will be converted to RGB and resized to 224 × 224 pixels.")
        predict_clicked = st.button(
            "Analyze image",
            type="primary",
            use_container_width=True,
        )
        if st.button("Clear image", use_container_width=True):
            st.rerun()

    if predict_clicked:
        with st.spinner("Analyzing image..."):
            try:
                result = predict_image_bytes(uploaded_file.getvalue(), model)
            except PredictionError as exc:
                st.error(str(exc))
            else:
                label = result["prediction"].upper()
                confidence = result["confidence"] * 100
                explanation = {
                    "CAT": "The model identified this image as a cat.",
                    "DOG": "The model identified this image as a dog.",
                    "NEITHER": "The model identified this image as neither a cat nor a dog.",
                }[label]
                st.markdown(
                    f"""
                    <div class="result-card">
                        <div class="result-label">Prediction</div>
                        <div class="result-value">{label}</div>
                        <p class="result-copy">{explanation}</p>
                        <p class="result-copy">Model score: {confidence:.2f}%</p>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )
                st.caption(
                    "The score is the highest softmax output. It is not a guarantee "
                    "that the prediction is correct."
                )
                st.markdown("#### Class scores")
                for class_name, score in result["class_scores"].items():
                    st.progress(float(score), text=f"{class_name.title()}: {score:.2%}")
else:
    st.info("Choose a JPG, JPEG, or PNG image above to get started.")

st.divider()
st.caption("Powered by a TensorFlow/Keras MobileNetV2 image classifier.")
