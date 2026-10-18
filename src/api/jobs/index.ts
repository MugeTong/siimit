import { deleteJob } from "./delete-job";
import { getJob } from "./get-job";
import { listJobs } from "./list-jobs";
import { stopJob } from "./stop-job";

export const jobsApi = {
  deleteJob,
  getJob,
  listJobs,
  stopJob,
};
