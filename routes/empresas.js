import express from "express"
import { getEmpresas, getEmpresa, postEmpresa, putEmpresa, deleteEmpresa } from "../controllers/empresasController.js";

const router = express.Router()

router.get("/",getEmpresas)
router.get("/:id",getEmpresa)
router.post("/",postEmpresa)
router.put("/:id",putEmpresa)
router.delete("/:id",deleteEmpresa)

export default router;