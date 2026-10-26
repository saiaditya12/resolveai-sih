export const complaintSteps = [
  "Institution",
  "Complaint details",
  "Evidence",
  "Review",
  "Submitted",
];
export function ComplaintStepper({ step }: { step: number }) {
  return (
    <nav
      className="complaint-stepper"
      aria-label="Complaint submission progress"
    >
      <p className="compact-step">
        Step {step + 1} of 5 <strong>{complaintSteps[step]}</strong>
      </p>
      <ol>
        {complaintSteps.map((label, index) => (
          <li
            key={label}
            aria-current={index === step ? "step" : undefined}
            className={
              index < step ? "complete" : index === step ? "active" : ""
            }
          >
            <span aria-hidden="true">
              {index < step ? "✓" : `0${index + 1}`}
            </span>
            <span>{label}</span>
            {index < step && <span className="sr-only"> completed</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
