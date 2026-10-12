import { Logo } from './Logo';
import { Sheet } from './Sheet';

/** Окно по нажатию на логотип на главной */
export function About({ onClose }: { onClose: () => void }) {
  return (
    <Sheet onClose={onClose}>
      <div className="about">
        <Logo size={64} />
        <div className="about-title">
          Трекер <b>задач</b>
        </div>
        <p>Ленись только на пенсии. Сегодня ты рабочая машина, завтра легенда. Открывай трекер, закрывай задачи, забирай победу.</p>
        <p>Клиент хочет невозможное? Отлично, у нас для этого есть отдел.</p>
        <p className="about-last">Мы сделаем всё: от минета до гандона!</p>
        <button className="primary" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </Sheet>
  );
}
