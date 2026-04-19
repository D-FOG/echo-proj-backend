import { Router } from "express";
import multer from "multer";
import {
  createInvoice,
  uploadInvoiceFile,
  sendInvoice,
  getAdminInvoices,
  getUserInvoices,
  getInvoiceDetail,
  uploadPaymentReceipt,
  confirmPayment,
  getPendingReceipts,
} from "../controllers/invoice.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Apply authentication to all routes
router.use(authenticate);

// Admin routes
router.post("/admin", authorize("admin"), createInvoice);
router.post("/admin/upload", authorize("admin"), upload.single("file"), uploadInvoiceFile);
router.post("/admin/send", authorize("admin"), sendInvoice);
router.get("/admin", authorize("admin"), getAdminInvoices);
router.get("/admin/receipts/pending", authorize("admin"), getPendingReceipts);
router.post("/admin/confirm-payment", authorize("admin"), confirmPayment);

// User routes
router.get("/", getUserInvoices);
router.get("/:id", getInvoiceDetail);
router.post("/:id/receipt", upload.single("receipt"), uploadPaymentReceipt);

export default router;
