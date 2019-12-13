export default function numberToValidPort(
  value: number,
  minPort: number,
  maxPort: number,
) {
  const range = maxPort + 1 - minPort;
  const index = value % range;
  return minPort + index;
}
