import { Router } from 'express';
import multer from 'multer';
import { MAX_UPLOAD_BYTES, UPLOADS_DIR, storageKeyFor } from '../config/uploads.js';
import {
  addAttachment,
  addComment,
  completeTask,
  createTask,
  deleteAttachment,
  deleteTask,
  getTask,
  listCategories,
  listTasks,
  startTask,
  updateTask,
} from '../controllers/task.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  commentSchema,
  createTaskSchema,
  listTasksQuerySchema,
  updateTaskSchema,
} from '../validations/task.schema.js';

const taskRouter = Router();
const categoryRouter = Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (_req, file, callback) => callback(null, storageKeyFor(file.originalname)),
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

categoryRouter.use(requireAuth());
categoryRouter.get('/', listCategories);

taskRouter.use(requireAuth());
taskRouter.get('/', validate(listTasksQuerySchema, 'query'), listTasks);
taskRouter.post('/', requireRole('supervisor'), validate(createTaskSchema), createTask);
taskRouter.delete('/attachments/:id', deleteAttachment);
taskRouter.get('/:id', getTask);
taskRouter.patch('/:id', requireRole('supervisor'), validate(updateTaskSchema), updateTask);
taskRouter.delete('/:id', requireRole('supervisor'), deleteTask);
taskRouter.post('/:id/start', startTask);
taskRouter.post('/:id/complete', completeTask);
taskRouter.post('/:id/comments', validate(commentSchema), addComment);
taskRouter.post('/:id/attachments', upload.single('file'), addAttachment);

export { categoryRouter, taskRouter };