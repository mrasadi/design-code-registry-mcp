/** Base class for all registry-domain errors. Carries a stable machine-readable `code`. */
export class RegistryError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "RegistryError";
    this.code = code;
  }
}

export class RegistryNotFoundError extends RegistryError {
  constructor(path: string) {
    super(
      "REGISTRY_NOT_FOUND",
      `No registry found at "${path}". Run registry_init (or "design-code-registry init") first.`,
    );
    this.name = "RegistryNotFoundError";
  }
}

export class RegistryAlreadyExistsError extends RegistryError {
  constructor(path: string) {
    super("REGISTRY_ALREADY_EXISTS", `A registry already exists at "${path}".`);
    this.name = "RegistryAlreadyExistsError";
  }
}

export class DuplicateIdError extends RegistryError {
  constructor(kind: string, id: string) {
    super("DUPLICATE_ID", `A ${kind} with id "${id}" already exists. Use the update operation instead.`);
    this.name = "DuplicateIdError";
  }
}

export class NotFoundError extends RegistryError {
  constructor(kind: string, id: string) {
    super("NOT_FOUND", `No ${kind} with id "${id}" was found in the registry.`);
    this.name = "NotFoundError";
  }
}

export class ValidationFailedError extends RegistryError {
  readonly issues: string[];
  constructor(issues: string[]) {
    super("VALIDATION_FAILED", `Validation failed:\n${issues.join("\n")}`);
    this.name = "ValidationFailedError";
    this.issues = issues;
  }
}
