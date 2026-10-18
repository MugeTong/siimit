type ServiceSuccessResponse<T> = {
  ResponseMetadata: {
    Action: string;
    Service: string;
  };
  Result: T;
};
type ServiceErrorResponse = {
  ResponseMetadata: {
    Action: string;
    Error: {
      Code: string;
      Message: string;
    };
  };
};

export type ServiceResponse<T> =
  ServiceSuccessResponse<T> | ServiceErrorResponse;
