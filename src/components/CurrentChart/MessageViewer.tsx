import { formatIstDateTime } from '../../current-chart/application/trainDescriptions';
import type { EpenMessage } from '../../current-chart/domain';
import { FloatingPanel } from '../common/FloatingPanel';

/** Shows a saved EPEN note when its MSG label is clicked. */
export function MessageViewer({ message, onClose }: { message: EpenMessage; onClose: () => void }) {
  const where = message.stationCode ? ` at ${message.stationCode}` : '';
  return (
    <FloatingPanel
      title={`Message — ${formatIstDateTime(message.at)}${where}`}
      onClose={onClose}
      className="message-viewer"
    >
      <img src={message.payload} alt="Handwritten controller note" />
      <p className="muted">Saved {formatIstDateTime(message.savedAt)}</p>
    </FloatingPanel>
  );
}
