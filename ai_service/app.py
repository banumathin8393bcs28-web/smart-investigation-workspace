"""
FastAPI Microservice for AI Object Detection in Crime Scene Media
Smart Investigation Workspace
Using Ultralytics YOLOv8 for authentic forensic computer vision analysis.
"""

import os
import sys
from typing import Optional, List
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(
    title="Smart Investigation AI Object Detection Service",
    description="Ultralytics YOLOv8 Forensic Object Detection Microservice for Smart Investigation Workspace",
    version="1.0.0"
)

# Global YOLO model instance
_model = None

def get_yolo_model():
    global _model
    if _model is None:
        try:
            from ultralytics import YOLO
            # Locate local weights file reliably
            weights_paths = [
                os.path.join(os.path.dirname(__file__), "yolov8n.pt"),
                os.path.join(os.path.dirname(__file__), "..", "yolov8n.pt"),
                "yolov8n.pt"
            ]
            weights_to_load = "yolov8n.pt"
            for wp in weights_paths:
                if os.path.exists(wp):
                    weights_to_load = wp
                    break
            _model = YOLO(weights_to_load)
            print(f"[AIService] Successfully loaded Ultralytics YOLOv8n model from: {weights_to_load}")
        except Exception as e:
            print(f"[AIService] Failed to load Ultralytics YOLO: {e}", file=sys.stderr)
            raise
    return _model

class DetectionRequest(BaseModel):
    filePath: str
    contextTerms: Optional[List[str]] = Field(default_factory=list)
    confidenceThreshold: Optional[float] = 0.25

class BoundingBoxItem(BaseModel):
    id: str
    label: str
    category: str
    confidence: float
    bbox: List[float]  # [x, y, width, height] in percentages (0-100)
    notes: Optional[str] = ""

class DetectionResponse(BaseModel):
    analyzed: bool
    analyzedAt: str
    model: str
    version: str
    confidenceThreshold: float
    summary: str
    detections: List[BoundingBoxItem]

@app.get("/")
def health_check():
    has_ultralytics = False
    try:
        import ultralytics
        has_ultralytics = True
    except ImportError:
        pass

    return {
        "status": "online",
        "service": "Smart Investigation AI Object Detection Microservice",
        "model": "Ultralytics YOLOv8n",
        "ultralyticsInstalled": has_ultralytics,
        "supportedFormats": ["jpg", "jpeg", "png", "webp"],
        "note": "AI predictions assist forensic investigation and do not constitute conclusive judicial proof."
    }

@app.post("/detect", response_model=DetectionResponse)
def detect_objects(req: DetectionRequest):
    if not os.path.exists(req.filePath):
        raise HTTPException(status_code=404, detail=f"Evidence image file not found on disk: {req.filePath}")

    import datetime
    now_str = datetime.datetime.now().isoformat()
    conf_thresh = max(0.05, min(0.95, req.confidenceThreshold or 0.25))

    detections: List[BoundingBoxItem] = []

    try:
        model = get_yolo_model()
        results = model.predict(source=req.filePath, conf=conf_thresh, save=False, verbose=False)

        for result_idx, result in enumerate(results):
            boxes = result.boxes
            if boxes is None or len(boxes) == 0:
                continue

            orig_h, orig_w = result.orig_shape[0], result.orig_shape[1]
            if orig_w == 0 or orig_h == 0:
                continue

            for box_idx, box in enumerate(boxes):
                cls_id = int(box.cls[0].item())
                cls_name = model.names.get(cls_id, f"class_{cls_id}")
                conf = float(box.conf[0].item())

                # xyxy coordinates: [x1, y1, x2, y2]
                xyxy = box.xyxy[0].tolist()
                x1, y1, x2, y2 = xyxy[0], xyxy[1], xyxy[2], xyxy[3]

                # Convert to percentage [x, y, width, height]
                px = round((x1 / orig_w) * 100, 2)
                py = round((y1 / orig_h) * 100, 2)
                pw = round(((x2 - x1) / orig_w) * 100, 2)
                ph = round(((y2 - y1) / orig_h) * 100, 2)

                # Clamp values
                px = max(0.0, min(100.0, px))
                py = max(0.0, min(100.0, py))
                pw = max(0.1, min(100.0 - px, pw))
                ph = max(0.1, min(100.0 - py, ph))

                detections.append(BoundingBoxItem(
                    id=f"det_{result_idx}_{box_idx}_{cls_id}",
                    label=cls_name.capitalize(),
                    category=cls_name.lower(),
                    confidence=round(conf, 4),
                    bbox=[px, py, pw, ph],
                    notes=f"YOLOv8 inference detected '{cls_name}' with {round(conf * 100, 1)}% confidence."
                ))

    except Exception as e:
        print(f"[AIService] Inference error: {e}", file=sys.stderr)
        raise HTTPException(status_code=500, detail=f"YOLO inference error: {str(e)}")

    summary = (
        f"Detected {len(detections)} object(s) with confidence >= {round(conf_thresh * 100)}%."
        if detections else
        f"No objects detected above {round(conf_thresh * 100)}% confidence threshold."
    )

    return DetectionResponse(
        analyzed=True,
        analyzedAt=now_str,
        model="Ultralytics YOLOv8",
        version="8.1.0-forensic",
        confidenceThreshold=conf_thresh,
        summary=summary,
        detections=detections
    )

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--cli":
        import json
        file_path = sys.argv[2]
        conf_thresh = float(sys.argv[3]) if len(sys.argv) > 3 else 0.25
        req = DetectionRequest(filePath=file_path, confidenceThreshold=conf_thresh)
        try:
            result = detect_objects(req)
            # Output clean JSON on stdout for child_process integration
            print("__JSON_START__" + json.dumps(result.model_dump()) + "__JSON_END__")
        except Exception as err:
            print("__ERROR__" + str(err), file=sys.stderr)
            sys.exit(1)
        sys.exit(0)
    else:
        import uvicorn
        uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=False)
