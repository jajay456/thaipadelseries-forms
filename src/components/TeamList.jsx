import Avatar from "./Avatar.jsx";
import PayStatus from "./PayStatus.jsx";
import Confirmed from "./Confirmed.jsx";
import { findPerson } from "../lib/people.js";

function Person({ data, person, name, onOpen }) {
  const { meta } = data;
  const row = person?.row;
  return (
    <div className="person">
      <span className="pname link-ish" onClick={() => onOpen(person || { key: name, name, cats: [], paidBy: [] })}>{name}</span>
      <Confirmed person={person} />
      {row && meta.nation >= 0 && row[meta.nation] && <span className="muted">{row[meta.nation]}</span>}
      {!row && !person?.manual && <span className="tag">Not registered</span>}
      <PayStatus person={person} />
    </div>
  );
}

// รายชื่อแยกตามประเภท — คลิกชื่อเพื่อดูข้อมูลการสมัคร
export default function TeamList({ data, people, groups, onOpen }) {
  const { meta } = data;
  if (!groups.length) return <div className="state">No categories found</div>;
  const photo = (p) => (p?.row && meta.photo >= 0 ? p.row[meta.photo] : null);

  return (
    <div className="groups">
      {groups.map(([cat, teams]) => (
        <section key={cat} className="group">
          <h3>{cat} <span className="badge">{teams.length} {teams.some((t) => t.partner) ? (teams.length === 1 ? "team" : "teams") : (teams.length === 1 ? "player" : "players")}</span></h3>
          <ol>
            {teams.map((t, i) => {
              const a = findPerson(people, t.player), b = t.partner && findPerson(people, t.partner);
              return (
                <li key={i}>
                  <span className="n">{i + 1}</span>
                  <span className="avatars">
                    <Avatar name={t.player} photo={photo(a)} />
                    {t.partner && <Avatar name={t.partner} photo={photo(b)} />}
                  </span>
                  <div className="people">
                    <Person data={data} person={a} name={a?.name || t.player} onOpen={onOpen} />
                    {t.partner && <Person data={data} person={b} name={b?.name || t.partner} onOpen={onOpen} />}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
