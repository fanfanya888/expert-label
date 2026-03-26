from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import unquote
from uuid import uuid4

from fastapi import HTTPException

from app.core.config import get_settings

PROJECT_INSTRUCTION_UPLOAD_DIR = "project-instructions"
MAX_PROJECT_INSTRUCTION_IMAGE_BYTES = 10 * 1024 * 1024
ALLOWED_PROJECT_INSTRUCTION_IMAGE_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


def _normalize_filename(filename: str | None) -> str:
    if not filename:
        return "image"

    decoded = unquote(filename).strip()
    if not decoded:
        return "image"

    stem = Path(decoded).stem.strip()
    if not stem:
        return "image"

    normalized = re.sub(r"[^A-Za-z0-9_-]+", "-", stem)
    normalized = normalized.strip("-_")
    return normalized[:60] or "image"


def save_project_instruction_image(
    project_id: int,
    *,
    filename: str | None,
    content_type: str | None,
    content: bytes,
) -> dict[str, str | int]:
    if not content:
        raise HTTPException(status_code=422, detail="上传图片内容不能为空")

    if len(content) > MAX_PROJECT_INSTRUCTION_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="说明文档图片不能超过 10MB")

    normalized_content_type = (content_type or "").split(";", 1)[0].strip().lower()
    extension = ALLOWED_PROJECT_INSTRUCTION_IMAGE_TYPES.get(normalized_content_type)
    if extension is None:
        raise HTTPException(status_code=415, detail="说明文档当前只支持 PNG、JPG、WEBP、GIF 图片")

    safe_name = _normalize_filename(filename)
    stored_filename = f"{safe_name}-{uuid4().hex[:12]}{extension}"

    uploads_root = get_settings().uploads_root
    target_dir = uploads_root / PROJECT_INSTRUCTION_UPLOAD_DIR / str(project_id)
    target_dir.mkdir(parents=True, exist_ok=True)

    target_path = target_dir / stored_filename
    target_path.write_bytes(content)

    return {
        "url": f"/uploads/{PROJECT_INSTRUCTION_UPLOAD_DIR}/{project_id}/{stored_filename}",
        "filename": stored_filename,
        "content_type": normalized_content_type,
        "size": len(content),
        "original_filename": unquote(filename).strip() if filename else "",
    }
