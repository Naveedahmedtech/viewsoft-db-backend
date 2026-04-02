const path = require("path");
const axios = require("axios");

const db = require("../models").db;
const ViewerExport = db.viewer_export;
const Op = db.Sequelize.Op;

const REMOTE_FETCH_TIMEOUT_MS = 15000;
const REMOTE_FETCH_RETRIES = 2;
const BATCH_ARCHIVE_NAME = "canvas-exports-2026-04-01.zip";

function normalizeString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function buildLookupConditions(fileId, sourceFileUrl) {
  const conditions = [];

  if (fileId) {
    conditions.push({ fileId });
  }

  if (sourceFileUrl) {
    conditions.push({ sourceFileUrl });
  }

  return conditions;
}

function sanitizeFileName(fileName, fallbackBase) {
  const fallback = fallbackBase || "exported-file";
  const candidate = normalizeString(fileName) || fallback;
  const sanitized = candidate
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/\.+$/g, "")
    .trim();

  return sanitized || fallback;
}

function deriveFallbackFileName(record) {
  const fallbackBase = record.fileId || "exported-file";

  try {
    const exportedPath = new URL(record.exportedUrl).pathname;
    const ext = path.extname(exportedPath);
    return sanitizeFileName(record.fileName, `${fallbackBase}${ext || ".pdf"}`);
  } catch (err) {
    return sanitizeFileName(record.fileName, `${fallbackBase}.pdf`);
  }
}

function getResponseType(req, fallbackType) {
  const responseType = normalizeString(req.query?.responseType);
  return responseType ? responseType.toLowerCase() : fallbackType;
}

function getUniqueFileName(fileName, usedNames) {
  const parsed = path.parse(fileName);
  const ext = parsed.ext || "";
  const baseName = parsed.name || "exported-file";
  let candidate = `${baseName}${ext}`;
  let counter = 1;

  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${baseName}-${counter}${ext}`;
    counter += 1;
  }

  usedNames.add(candidate.toLowerCase());
  return candidate;
}

function getArchiver() {
  try {
    return require("archiver");
  } catch (err) {
    const dependencyError = new Error("Batch export download requires the archiver package to be installed.");
    dependencyError.statusCode = 500;
    throw dependencyError;
  }
}

async function fetchRemoteStream(url) {
  let lastError;

  for (let attempt = 0; attempt <= REMOTE_FETCH_RETRIES; attempt += 1) {
    try {
      return await axios.get(url, {
        responseType: "stream",
        timeout: REMOTE_FETCH_TIMEOUT_MS,
        validateStatus: (status) => status >= 200 && status < 300,
      });
    } catch (err) {
      lastError = err;
      if (attempt === REMOTE_FETCH_RETRIES) {
        throw err;
      }
    }
  }

  throw lastError;
}

async function findMatchingRecords(fileId, sourceFileUrl) {
  const conditions = buildLookupConditions(fileId, sourceFileUrl);
  if (!conditions.length) {
    return [];
  }

  return ViewerExport.findAll({
    where: {
      [Op.or]: conditions,
    },
    order: [["updatedAt", "DESC"]],
  });
}

async function resolveSingleRecord(fileId, sourceFileUrl) {
  const records = await findMatchingRecords(fileId, sourceFileUrl);

  if (!records.length) {
    return null;
  }

  const uniqueIds = new Set(records.map((record) => record.id));
  if (uniqueIds.size > 1) {
    const err = new Error("Multiple viewer export records matched the provided identifier(s).");
    err.statusCode = 409;
    throw err;
  }

  return records[0];
}

exports.register = async (req, res) => {
  const fileId = normalizeString(req.body?.fileId);
  const fileName = normalizeString(req.body?.fileName);
  const sourceFileUrl = normalizeString(req.body?.sourceFileUrl);
  const exportedUrl = normalizeString(req.body?.exportedUrl);

  if (!exportedUrl) {
    return res.status(400).send({
      message: "exportedUrl is required.",
    });
  }

  if (!fileId && !sourceFileUrl) {
    return res.status(400).send({
      message: "At least one of fileId or sourceFileUrl is required.",
    });
  }

  try {
    const existing = await resolveSingleRecord(fileId, sourceFileUrl);

    if (!existing) {
      const created = await ViewerExport.create({
        fileId,
        fileName,
        sourceFileUrl,
        exportedUrl,
      });

      return res.status(201).send({
        success: true,
        record: created,
      });
    }

    const updated = await existing.update({
      fileId: existing.fileId || fileId,
      fileName: fileName || existing.fileName,
      sourceFileUrl: existing.sourceFileUrl || sourceFileUrl,
      exportedUrl,
      updatedAt: new Date(),
    });

    return res.send({
      success: true,
      record: updated,
    });
  } catch (err) {
    console.error("Failed to register viewer export", err);
    return res.status(err.statusCode || 500).send({
      message: err.message || "Failed to register viewer export.",
    });
  }
};

exports.download = async (req, res) => {
  const fileId = normalizeString(req.body?.fileId);
  const sourceFileUrl = normalizeString(req.body?.sourceFileUrl);
  const responseType = getResponseType(req, "file");

  if (!fileId && !sourceFileUrl) {
    return res.status(400).send({
      message: "At least one of fileId or sourceFileUrl is required.",
    });
  }

  try {
    const record = await resolveSingleRecord(fileId, sourceFileUrl);

    if (!record) {
      return res.status(404).send({
        message: "Viewer export record not found.",
      });
    }

    if (!record.exportedUrl) {
      return res.status(404).send({
        message: "Viewer export URL is missing for the requested record.",
      });
    }

    if (responseType === "urls") {
      return res.send({
        success: true,
        exportedUrl: record.exportedUrl,
      });
    }

    const response = await fetchRemoteStream(record.exportedUrl);
    const downloadName = deriveFallbackFileName(record);
    const contentType = response.headers["content-type"] || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);

    response.data.on("error", (streamErr) => {
      console.error("Viewer export stream failed", streamErr);
      if (!res.headersSent) {
        res.status(502).end();
      } else {
        res.end();
      }
    });

    return response.data.pipe(res);
  } catch (err) {
    console.error("Failed to download viewer export", err);
    const statusCode = err.statusCode || (err.code === "ECONNABORTED" ? 504 : 502);
    return res.status(statusCode).send({
      message: err.message || "Failed to download viewer export.",
    });
  }
};

exports.downloadBatch = async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : null;
  const responseType = getResponseType(req, "zip");

  if (!items || !items.length) {
    return res.status(400).send({
      message: "items must be a non-empty array.",
    });
  }

  const normalizedItems = items.map((item) => ({
    fileId: normalizeString(item?.fileId),
    sourceFileUrl: normalizeString(item?.sourceFileUrl),
  }));

  const invalidItemIndex = normalizedItems.findIndex((item) => !item.fileId && !item.sourceFileUrl);
  if (invalidItemIndex >= 0) {
    return res.status(400).send({
      message: `Each item must include fileId or sourceFileUrl. Invalid item index: ${invalidItemIndex}.`,
    });
  }

  try {
    const archiver = getArchiver();
    const resolvedRecords = [];
    const skipped = [];
    const seenRecordIds = new Set();
    const usedZipNames = new Set();
    let includedCount = 0;

    for (const item of normalizedItems) {
      try {
        const record = await resolveSingleRecord(item.fileId, item.sourceFileUrl);

        if (!record) {
          skipped.push({
            fileId: item.fileId,
            sourceFileUrl: item.sourceFileUrl,
            reason: "Record not found",
          });
          continue;
        }

        if (seenRecordIds.has(record.id)) {
          continue;
        }

        seenRecordIds.add(record.id);
        resolvedRecords.push(record);
      } catch (err) {
        skipped.push({
          fileId: item.fileId,
          sourceFileUrl: item.sourceFileUrl,
          reason: err.message || "Record lookup failed",
        });
      }
    }

    if (responseType === "urls") {
      return res.send({
        success: true,
        exportedUrls: resolvedRecords.map((record) => record.exportedUrl).filter(Boolean),
        skipped,
      });
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${BATCH_ARCHIVE_NAME}"`);

    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("error", (err) => {
      console.error("Viewer export zip creation failed", err);
      if (!res.headersSent) {
        res.status(500).send({
          message: "Failed to create viewer export archive.",
        });
      } else {
        res.end();
      }
    });

    archive.pipe(res);

    for (const record of resolvedRecords) {
      if (!record.exportedUrl) {
        skipped.push({
          fileId: record.fileId,
          sourceFileUrl: record.sourceFileUrl,
          reason: "exportedUrl is missing",
        });
        continue;
      }

      try {
        const response = await fetchRemoteStream(record.exportedUrl);
        const zipEntryName = getUniqueFileName(deriveFallbackFileName(record), usedZipNames);
        archive.append(response.data, { name: zipEntryName });
        includedCount += 1;
      } catch (err) {
        console.error("Failed to fetch remote viewer export for batch download", err);
        skipped.push({
          fileId: record.fileId,
          sourceFileUrl: record.sourceFileUrl,
          reason: err.message || "Remote download failed",
        });
      }
    }

    archive.append(JSON.stringify({
      generatedAt: new Date().toISOString(),
      requested: normalizedItems.length,
      included: includedCount,
      skipped,
    }, null, 2), { name: "manifest.json" });

    await archive.finalize();
  } catch (err) {
    console.error("Failed to create batch viewer export download", err);
    return res.status(500).send({
      message: err.message || "Failed to create viewer export batch download.",
    });
  }
};
