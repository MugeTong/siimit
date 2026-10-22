import { deleteJob } from "./delete-job";
import { getJobLogs } from "./get-job-logs";
import { getJob } from "./get-job";
import { listJobEvents } from "./list-job-events";
import { listJobInstances } from "./list-job-instances";
import { listJobs } from "./list-jobs";
import { stopJob } from "./stop-job";
import { submitJob } from "./submit-job";

export const jobsApi = {
    deleteJob,
    getJob,
    getJobLogs,
    listJobEvents,
    listJobInstances,
    listJobs,
    stopJob,
    submitJob,
};
