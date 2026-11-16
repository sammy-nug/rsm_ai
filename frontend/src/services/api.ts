export type PredictionResponse = {
  prediction: string;
  scores: Record<string, number>;
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export async function predictImage(file: File): Promise<PredictionResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/predict`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? "The image could not be analyzed.");
  }

  return response.json() as Promise<PredictionResponse>;
}
