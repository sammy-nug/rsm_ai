# Cat, Dog, or Neither

AI-powered image recognition system for the Tech4Youth AI Engineering Capstone.
The current interface uses React and TypeScript, with a FastAPI backend serving
the existing TensorFlow/Keras model. The original Streamlit application remains
available in `app.py` as a backup.

## Project structure

```text
RMS_AI/
├── backend/
│   ├── main.py
│   ├── model_service.py
│   ├── requirements.txt
│   └── test_main.py
├── frontend/
│   ├── src/
│   │   ├── services/api.ts
│   │   ├── App.tsx
│   │   ├── index.css
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── public/
│       └── confusion_matrix.png
├── model/
│   └── cat_dog_neither_model.keras
├── utils/
│   └── prediction.py
├── app.py
└── Cat_Dog_or_Neither_Training.ipynb
```

The application reuses the existing trained model. It does not retrain or
modify the model.

## Run locally on Windows

The backend and frontend run in separate terminals.

### 1. Prepare the Python environment

From the project root:

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r backend\requirements.txt
```

If `.venv` already exists, activate it and install the backend requirements:

```powershell
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
```

### 2. Start the FastAPI backend

In the activated Python terminal:

```powershell
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

The API is available at `http://localhost:8000`. Health status is available at
`http://localhost:8000/health`, and interactive API documentation is available
at `http://localhost:8000/docs`.

### 3. Install and start the React frontend

Open a second terminal:

```powershell
cd "C:\Users\BEST PETERS COMPUTER\Desktop\RMS_AI\frontend"
npm install
npm run dev
```

Open `http://localhost:5173` in a browser.

The frontend uses `http://localhost:8000` by default. To use another backend
URL, create `frontend\.env.local` with:

```text
VITE_API_BASE_URL=http://localhost:8000
```

## Deploy to Vercel and Render

The React frontend is deployed to Vercel, and the FastAPI API and saved model
are deployed together to Render.

### 1. Deploy the frontend to Vercel

Import the GitHub repository into Vercel and set the project **Root Directory**
to `frontend`. Vercel detects Vite; the project builds with `npm run build` and
outputs to `dist`. The `frontend/vercel.json` file enables client-side routing.
Vite 7 requires Node.js 20.19+ or 22.12+; select a compatible version in the
Vercel project settings if needed.

After the first deployment, note the public Vercel origin, for example
`https://your-project.vercel.app` (no trailing slash).

### 2. Deploy the API to Render

Create a new **Blueprint** in Render and select this repository. Render reads
the root-level `render.yaml` to install `backend/requirements.txt` and start
the FastAPI application. Set `FRONTEND_ORIGINS` to the Vercel origin from step
1, with no trailing slash. The model file must remain committed at
`model/cat_dog_neither_model.keras`.

The root-level `.python-version` pins Render to Python 3.13.4, which is
compatible with the TensorFlow version pinned by the backend.

Once deployed, check `https://<your-render-service>.onrender.com/health`. It
should return `{"status":"ok"}` after the service starts and loads the model.

### 3. Connect the frontend to the API

In Vercel, open the project’s **Settings → Environment Variables** and add:

```text
VITE_API_BASE_URL=https://<your-render-service>.onrender.com
```

Apply it to the desired environments and redeploy the frontend. The value
should not have a trailing slash. If you use a custom Vercel domain, add that
domain’s origin to Render’s comma-separated `FRONTEND_ORIGINS` environment
variable as well.

The Render Blueprint uses the free instance plan. Free instances may spin down
when idle, so the first request can take longer. If the service runs out of
memory while loading TensorFlow or making predictions, upgrade it to an
instance with more memory.

## Prediction pipeline

The FastAPI backend validates the upload, opens it as RGB, resizes it to
`224 x 224`, and passes float32 pixel values in the original `0-255` range to
the model. The saved model contains its own MobileNetV2 rescaling layer, so the
backend does not rescale pixels a second time.

The output classes are `cat`, `dog`, and `neither`. The API returns all three
softmax scores. These are model scores and should not be treated as calibrated
probabilities or guarantees of correctness.

The React interface supports dark mode and multiple image uploads. Multiple
images are sent to the same `/predict` endpoint individually and displayed as
separate results.

The evaluation section displays the existing confusion-matrix artifact from the
training notebook. It can also calculate a new confusion matrix when a folder
with this structure is selected:

```text
evaluation-images/
├── cat/
├── dog/
└── neither/
```

The folder names provide the true labels; without labeled folders, a confusion
matrix cannot be calculated from ordinary uploads.

## Validation

Run the backend tests:

```powershell
.\.venv\Scripts\python.exe -m pytest backend\test_main.py -q
```

Build the frontend:

```powershell
cd frontend
npm run build
```

Also test the running application with cat, dog, and neither images; JPG, JPEG,
and PNG files; different image dimensions; corrupted files; and sequential
uploads.
