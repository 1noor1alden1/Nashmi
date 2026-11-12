import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import usersRouter from "./users.js";
import servicesRouter from "./services.js";
import transactionsRouter from "./transactions.js";
import reviewsRouter from "./reviews.js";
import notificationsRouter from "./notifications.js";
import proofsRouter from "./proofs.js";
import activityRouter from "./activity.js";
import profileRouter from "./profile-intelligence.js";
import disputesRouter from "./disputes.js";
import savedSearchesRouter from "./saved-searches.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/profile-intelligence", profileRouter);
router.use("/disputes", disputesRouter);
router.use("/saved-searches", savedSearchesRouter);
router.use("/services", servicesRouter);
router.use("/transactions", transactionsRouter);
router.use("/reviews", reviewsRouter);
router.use("/notifications", notificationsRouter);
router.use("/proofs", proofsRouter);
router.use("/activity", activityRouter);

export default router;
