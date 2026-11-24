(function () {
  var catalog = window.CATALOG;
  var nav = document.getElementById("nav");
  var main = document.getElementById("main");
  var search = document.getElementById("search");
  var clearBtn = document.getElementById("search-clear");
  var shell = document.getElementById("shell");
  var navToggle = document.getElementById("nav-toggle");
  var backdrop = document.getElementById("backdrop");
  var open = { "d:natural": true, "d:humanities": true };
  var query = "";

  var MATERIALS = [
    {
      id: "presentation",
      title: "Презентация",
      kind: "presentation",
      accept: ".ppt,.pptx,.pptm,.pps,.ppsx,.ppsm,.pot,.potx,.potm,.odp,.pdf,.key,.ptx"
    },
    {
      id: "method",
      title: "Методическая разработка",
      kind: "any",
      accept: ""
    },
    {
      id: "video",
      title: "Видео",
      kind: "video",
      accept: "video/*,.mp4,.m4v,.webm,.ogg,.ogv,.mov,.mkv,.avi,.wmv,.mpeg,.mpg,.m2ts,.3gp,.flv"
    }
  ];
  var renderGen = 0;
  var objectUrls = [];
  var dbPromise = null;
  var META_KEY = "mrc-presentation-materials-v1";
  var PRESENTATION_EXT = {
    ppt: 1, pptx: 1, pptm: 1, pps: 1, ppsx: 1, ppsm: 1,
    pot: 1, potx: 1, potm: 1, odp: 1, pdf: 1, key: 1, ptx: 1
  };
  var VIDEO_EXT = {
    mp4: 1, m4v: 1, webm: 1, ogg: 1, ogv: 1, mov: 1, mkv: 1,
    avi: 1, wmv: 1, mpeg: 1, mpg: 1, m2ts: 1, "3gp": 1, flv: 1
  };

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (key) {
      var value = attrs[key];
      if (value == null || value === false) return;
      if (key === "class") node.className = value;
      else node.setAttribute(key, value);
    });
    (children || []).forEach(function (child) {
      if (child == null || child === false) return;
      if (typeof child === "string" || typeof child === "number") {
        node.appendChild(document.createTextNode(String(child)));
      } else {
        node.appendChild(child);
      }
    });
    return node;
  }

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/\s+/g, " ")
      .trim();
  }

  function matches(haystack, q) {
    var tokens = normalize(q).split(" ").filter(Boolean);
    if (!tokens.length) return true;
    var text = normalize(haystack);
    return tokens.every(function (token) {
      return text.indexOf(token) !== -1;
    });
  }

  function plural(n, one, few, many) {
    var n10 = n % 10;
    var n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return one;
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
    return many;
  }

  function lessonCount(subject) {
    return subject.grades.reduce(function (sum, grade) {
      return sum + grade.lessons.length;
    }, 0);
  }

  function deptLessonCount(dept) {
    return dept.subjects.reduce(function (sum, subject) {
      return sum + lessonCount(subject);
    }, 0);
  }

  function stats() {
    var lessons = 0;
    var filled = 0;
    var empty = 0;
    catalog.departments.forEach(function (dept) {
      dept.subjects.forEach(function (subject) {
        var count = lessonCount(subject);
        lessons += count;
        if (count) filled += 1;
        else empty += 1;
      });
    });
    return { lessons: lessons, filled: filled, empty: empty };
  }

  function href() {
    return "#/" + Array.prototype.slice.call(arguments).filter(Boolean).join("/");
  }

  function currentHash() {
    var hash = location.hash;
    if (!hash || hash === "#") return "#/";
    return hash;
  }

  function isCurrent(parts) {
    return currentHash() === href.apply(null, parts);
  }

  function isAncestor(parts) {
    return currentHash().indexOf(href.apply(null, parts) + "/") === 0;
  }

  function parse() {
    var raw = currentHash().replace(/^#\/?/, "");
    var parts = raw.split("/").filter(Boolean);
    return {
      dept: parts[0] || null,
      subject: parts[1] || null,
      grade: parts[2] || null,
      lesson: parts[3] || null
    };
  }

  function resolve() {
    var parts = parse();
    if (!parts.dept) return { level: "home" };
    var dept = findById(catalog.departments, parts.dept);
    if (!dept) return { level: "missing" };
    if (!parts.subject) return { level: "dept", d: dept };
    var subject = findById(dept.subjects, parts.subject);
    if (!subject) return { level: "missing" };
    if (!parts.grade) return { level: "subject", d: dept, s: subject };
    var grade = findById(subject.grades, parts.grade);
    if (!grade) return { level: "missing" };
    if (!parts.lesson) return { level: "grade", d: dept, s: subject, g: grade };
    var lesson = findById(grade.lessons, parts.lesson);
    if (!lesson) return { level: "missing" };
    return { level: "lesson", d: dept, s: subject, g: grade, l: lesson };
  }

  function findById(list, id) {
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function searching() {
    return normalize(query).length > 0;
  }

  function collectHits() {
    var hits = [];
    catalog.departments.forEach(function (dept) {
      dept.subjects.forEach(function (subject) {
        if (!subject.grades.length && matches([subject.title, subject.index, subject.note, dept.title].join(" "), query)) {
          hits.push({ type: "subject", d: dept, s: subject });
        }
        subject.grades.forEach(function (grade) {
          var gradeBlob = [grade.title, subject.title, subject.index].join(" ");
          if (!grade.lessons.length && matches(gradeBlob, query)) {
            hits.push({ type: "empty-grade", d: dept, s: subject, g: grade });
          }
          grade.lessons.forEach(function (lesson) {
            var blob = [lesson.title, "урок " + lesson.n, grade.title, subject.title, subject.index, dept.title].join(" ");
            if (matches(blob, query)) {
              hits.push({ type: "lesson", d: dept, s: subject, g: grade, l: lesson });
            }
          });
        });
      });
    });
    return hits;
  }

  function hitIndex(hits) {
    var depts = {};
    var subjects = {};
    var grades = {};
    var lessons = {};
    hits.forEach(function (hit) {
      depts[hit.d.id] = true;
      subjects[hit.d.id + "/" + hit.s.id] = true;
      if (hit.g) grades[hit.d.id + "/" + hit.s.id + "/" + hit.g.id] = true;
      if (hit.l) lessons[hit.d.id + "/" + hit.s.id + "/" + hit.g.id + "/" + hit.l.id] = true;
    });
    return { depts: depts, subjects: subjects, grades: grades, lessons: lessons };
  }

  function chevron(isOpen) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("class", "chev-icon" + (isOpen ? " is-open" : ""));
    svg.setAttribute("aria-hidden", "true");
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M6 3.5 11 8 6 12.5");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "1.6");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.appendChild(path);
    return svg;
  }

  function treeRow(options) {
    var row = el("div", {
      class: "tree-row depth-" + options.depth +
        (options.current ? " is-current" : "") +
        (options.ancestor ? " is-ancestor" : "")
    });
    if (options.onToggle) {
      var button = el("button", {
        class: "chev",
        type: "button",
        "aria-expanded": options.opened ? "true" : "false",
        "aria-label": options.opened ? "Свернуть" : "Развернуть"
      });
      button.appendChild(chevron(options.opened));
      button.addEventListener("click", options.onToggle);
      row.appendChild(button);
    } else {
      row.appendChild(el("span", { class: "chev chev-spacer", "aria-hidden": "true" }));
    }
    var link = el("a", { href: options.href, class: "tree-link" });
    if (options.current) link.setAttribute("aria-current", "page");
    if (options.index) link.appendChild(el("span", { class: "tree-index" }, [options.index]));
    link.appendChild(el("span", { class: "tree-label" }, [options.label]));
    row.appendChild(link);
    if (options.count != null) row.appendChild(el("span", { class: "tree-count" }, [options.count]));
    return row;
  }

  function renderNav(ctx) {
    var hits = searching() ? collectHits() : null;
    var index = hits ? hitIndex(hits) : null;
    var top = nav.scrollTop;
    nav.innerHTML = "";
    nav.appendChild(el("p", { class: "nav-label" }, [searching() ? "Результаты" : "Программа"]));
    var visible = 0;

    catalog.departments.forEach(function (dept) {
      if (index && !index.depts[dept.id]) return;
      visible += 1;
      var deptKey = "d:" + dept.id;
      var deptOpen = searching() || !!open[deptKey];
      var block = el("div", { class: "tree-dept" });
      var count = deptLessonCount(dept);
      block.appendChild(treeRow({
        depth: 0,
        href: href(dept.id),
        index: dept.index,
        label: dept.title,
        count: count ? String(count) : "—",
        current: isCurrent([dept.id]),
        ancestor: isAncestor([dept.id]),
        opened: deptOpen,
        onToggle: searching() ? null : function () {
          open[deptKey] = !open[deptKey];
          renderNav(resolve());
        }
      }));

      if (deptOpen) {
        dept.subjects.forEach(function (subject) {
          var subjectPath = dept.id + "/" + subject.id;
          if (index && !index.subjects[subjectPath]) return;
          var subjectKey = "s:" + subjectPath;
          var subjectOpen = searching() || !!open[subjectKey];
          var subjectCount = lessonCount(subject);
          block.appendChild(treeRow({
            depth: 1,
            href: href(dept.id, subject.id),
            index: subject.index,
            label: subject.title,
            count: subjectCount ? String(subjectCount) : "—",
            current: isCurrent([dept.id, subject.id]),
            ancestor: isAncestor([dept.id, subject.id]),
            opened: subjectOpen,
            onToggle: searching() || !subject.grades.length ? null : function () {
              open[subjectKey] = !open[subjectKey];
              renderNav(resolve());
            }
          }));
          if (!subjectOpen) return;
          subject.grades.forEach(function (grade) {
            var gradePath = subjectPath + "/" + grade.id;
            if (index && !index.grades[gradePath]) return;
            var gradeKey = "g:" + gradePath;
            var gradeOpen = searching() || !!open[gradeKey];
            block.appendChild(treeRow({
              depth: 2,
              href: href(dept.id, subject.id, grade.id),
              label: grade.title,
              count: grade.lessons.length ? String(grade.lessons.length) : "—",
              current: isCurrent([dept.id, subject.id, grade.id]),
              ancestor: isAncestor([dept.id, subject.id, grade.id]),
              opened: gradeOpen,
              onToggle: searching() || !grade.lessons.length ? null : function () {
                open[gradeKey] = !open[gradeKey];
                renderNav(resolve());
              }
            }));
            if (!gradeOpen) return;
            grade.lessons.forEach(function (lesson) {
              var lessonPath = gradePath + "/" + lesson.id;
              if (index && !index.lessons[lessonPath]) return;
              block.appendChild(treeRow({
                depth: 3,
                href: href(dept.id, subject.id, grade.id, lesson.id),
                label: "Урок " + lesson.n + ". " + lesson.title,
                current: isCurrent([dept.id, subject.id, grade.id, lesson.id])
              }));
            });
          });
        });
      }
      nav.appendChild(block);
    });

    if (searching() && !visible) {
      nav.appendChild(el("p", { class: "nav-empty" }, ["Ничего не нашлось"]));
    }
    nav.scrollTop = top;
    if (ctx && arguments[1]) {
      var current = nav.querySelector('[aria-current="page"]');
      if (current && current.scrollIntoView) current.scrollIntoView({ block: "nearest" });
    }
  }

  function page() {
    return el("div", { class: "page" });
  }

  function crumbs(items) {
    var node = el("nav", { class: "crumbs", "aria-label": "Путь" });
    items.forEach(function (item, index) {
      if (index) node.appendChild(document.createTextNode(" / "));
      if (item.href) node.appendChild(el("a", { href: item.href }, [item.label]));
      else node.appendChild(el("span", {}, [item.label]));
    });
    return node;
  }

  function miniCard(dept, subject, grade, lesson, showGrade) {
    var link = el("a", {
      class: "mini-card",
      href: href(dept.id, subject.id, grade.id, lesson.id)
    });
    var top = el("div", { class: "mini-top" });
    top.appendChild(el("span", {}, [showGrade ? grade.title : subject.title]));
    top.appendChild(el("span", {}, ["Урок " + lesson.n]));
    link.appendChild(top);
    link.appendChild(el("p", { class: "mini-title" }, [lesson.title]));
    return link;
  }

  function gradeLinks(dept, subject) {
    var list = el("div", { class: "grade-links" });
    subject.grades.forEach(function (grade) {
      var link = el("a", {
        class: "grade-link" + (grade.lessons.length ? "" : " is-empty"),
        href: href(dept.id, subject.id, grade.id)
      });
      link.appendChild(el("span", { class: "grade-link-title" }, [grade.title]));
      link.appendChild(el("span", { class: "grade-link-meta" }, [
        grade.lessons.length
          ? grade.lessons.length + " " + plural(grade.lessons.length, "урок", "урока", "уроков")
          : "пусто"
      ]));
      list.appendChild(link);
    });
    return list;
  }

  function subjectSection(dept, subject, headingTag) {
    var section = el("section", { class: "subject-block" });
    var heading = el(headingTag);
    var link = el("a", { href: href(dept.id, subject.id) });
    link.appendChild(el("span", { class: "subject-index" }, [subject.index]));
    link.appendChild(document.createTextNode(subject.title));
    heading.appendChild(link);
    section.appendChild(heading);
    if (!subject.grades.length) {
      section.appendChild(el("a", { class: "empty-subject", href: href(dept.id, subject.id) }, [
        subject.note || "В этой ветке пока нет классов и уроков."
      ]));
      return section;
    }
    section.appendChild(gradeLinks(dept, subject));
    return section;
  }

  function statRow() {
    var numbers = stats();
    var row = el("dl", { class: "stats" });
    [
      [numbers.lessons, "урок в каталоге", "урока в каталоге", "уроков в каталоге"],
      [numbers.filled, "предмет с уроками", "предмета с уроками", "предметов с уроками"],
      [numbers.empty, "предмет без уроков", "предмета без уроков", "предметов без уроков"]
    ].forEach(function (item) {
      var cell = el("div");
      cell.appendChild(el("dt", {}, [item[0]]));
      cell.appendChild(el("dd", {}, [plural(item[0], item[1], item[2], item[3])]));
      row.appendChild(cell);
    });
    return row;
  }

  function renderHome() {
    var root = page();
    root.appendChild(el("h1", {}, [catalog.title]));
    root.appendChild(el("p", { class: "lead" }, [
      "Открытый каталог уроков. К каждому уроку можно приложить презентацию, методическую разработку и видео."
    ]));
    root.appendChild(statRow());
    catalog.departments.forEach(function (dept) {
      var section = el("section", { class: "dept-block" });
      var heading = el("h2");
      heading.appendChild(el("a", { href: href(dept.id) }, [dept.index + ". " + dept.title]));
      section.appendChild(heading);
      dept.subjects.forEach(function (subject) {
        section.appendChild(subjectSection(dept, subject, "h3"));
      });
      root.appendChild(section);
    });
    main.appendChild(root);
  }

  function renderDept(ctx) {
    var count = deptLessonCount(ctx.d);
    var root = page();
    root.appendChild(crumbs([{ href: "#/", label: "Каталог" }]));
    root.appendChild(el("p", { class: "kicker" }, ["Кафедра " + ctx.d.index]));
    root.appendChild(el("h1", {}, [ctx.d.title]));
    root.appendChild(el("p", { class: "lead" }, [
      count
        ? count + " " + plural(count, "урок", "урока", "уроков") + "."
        : "В этой кафедре уроков пока нет."
    ]));
    ctx.d.subjects.forEach(function (subject) {
      root.appendChild(subjectSection(ctx.d, subject, "h2"));
    });
    main.appendChild(root);
  }

  function renderSubject(ctx) {
    var count = lessonCount(ctx.s);
    var root = page();
    root.appendChild(crumbs([
      { href: "#/", label: "Каталог" },
      { href: href(ctx.d.id), label: ctx.d.title }
    ]));
    root.appendChild(el("p", { class: "kicker" }, [ctx.s.index]));
    root.appendChild(el("h1", {}, [ctx.s.title]));
    if (!ctx.s.grades.length) {
      root.appendChild(el("p", { class: "lead" }, [ctx.s.note || "В этой ветке пока нет классов и уроков."]));
      main.appendChild(root);
      return;
    }
    root.appendChild(el("p", { class: "lead" }, [
      count
        ? count + " " + plural(count, "урок", "урока", "уроков") + ". Список уроков открывается в выбранном классе."
        : "Классы уже стоят в программе. Уроков пока нет."
    ]));
    root.appendChild(gradeLinks(ctx.d, ctx.s));
    main.appendChild(root);
  }

  function renderGrade(ctx) {
    var root = page();
    root.appendChild(crumbs([
      { href: "#/", label: "Каталог" },
      { href: href(ctx.d.id), label: ctx.d.title },
      { href: href(ctx.d.id, ctx.s.id), label: ctx.s.title }
    ]));
    root.appendChild(el("p", { class: "kicker" }, [ctx.s.title]));
    root.appendChild(el("h1", {}, [ctx.g.title]));
    if (!ctx.g.lessons.length) {
      root.appendChild(el("p", { class: "lead" }, ["В программе этот класс есть. Уроков пока нет."]));
      main.appendChild(root);
      return;
    }
    var list = el("div", { class: "mini-list" });
    ctx.g.lessons.forEach(function (lesson) {
      list.appendChild(miniCard(ctx.d, ctx.s, ctx.g, lesson, false));
    });
    root.appendChild(list);
    main.appendChild(root);
  }

  function extOf(name) {
    var match = /\.([a-z0-9]+)$/i.exec(name || "");
    return match ? match[1].toLowerCase() : "";
  }

  function fileAllowed(kind, file) {
    if (kind === "any") return true;
    var ext = extOf(file.name);
    if (kind === "presentation") return !!PRESENTATION_EXT[ext];
    if (kind === "video") return !!VIDEO_EXT[ext] || /^video\//.test(file.type || "");
    return false;
  }

  function rejectMessage(kind) {
    if (kind === "video") return "Нужен видеофайл.";
    return "Для презентации подходят PPT, PPTX, PDF, ODP и похожие файлы.";
  }

  function isPlayableVideo(meta) {
    var ext = extOf(meta.name);
    if (ext === "mp4" || ext === "m4v" || ext === "webm" || ext === "ogg" || ext === "ogv") return true;
    var type = meta.type || "";
    return type === "video/mp4" || type === "video/webm" || type === "video/ogg";
  }

  function formatSize(bytes) {
    var n = Number(bytes) || 0;
    if (n < 1024) return n + " Б";
    if (n < 1048576) return Math.max(1, Math.round(n / 1024)) + " КБ";
    var mb = n / 1048576;
    var text = mb >= 10 ? String(Math.round(mb)) : mb.toFixed(1).replace(/\.0$/, "").replace(".", ",");
    return text + " МБ";
  }

  function normalizeLink(raw) {
    var text = String(raw || "").trim();
    if (!text || /\s/.test(text)) return null;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) text = "https://" + text;
    var url;
    try {
      url = new URL(text);
    } catch (e) {
      return null;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname) return null;
    return url.href;
  }

  function lessonKey(ctx) {
    return ctx.d.id + "/" + ctx.s.id + "/" + ctx.g.id + "/" + ctx.l.id;
  }

  function emptyRecord() {
    return {
      presentation: { links: [], files: [] },
      method: { links: [], files: [] },
      video: { links: [], files: [] }
    };
  }

  function normalizeRecord(materials) {
    var record = emptyRecord();
    MATERIALS.forEach(function (material) {
      var slot = materials && materials[material.id] ? materials[material.id] : {};
      record[material.id] = {
        files: Array.isArray(slot.files) ? slot.files : [],
        links: Array.isArray(slot.links) ? slot.links : []
      };
    });
    return record;
  }

  function revokeUrls() {
    objectUrls.forEach(function (url) {
      URL.revokeObjectURL(url);
    });
    objectUrls = [];
  }

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function readMeta() {
    try {
      var parsed = JSON.parse(localStorage.getItem(META_KEY) || "{}");
      if (!parsed || typeof parsed !== "object") return {};
      return parsed;
    } catch (error) {
      return {};
    }
  }

  function writeMeta(all) {
    localStorage.setItem(META_KEY, JSON.stringify(all));
  }

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject(new Error("indexedDB"));
        return;
      }
      var request = indexedDB.open("mrc-presentation-files", 1);
      request.onupgradeneeded = function () {
        request.result.createObjectStore("files");
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
    return dbPromise;
  }

  function idbGet(id) {
    return openDb().then(function (database) {
      return new Promise(function (resolve, reject) {
        var request = database.transaction("files", "readonly").objectStore("files").get(id);
        request.onsuccess = function () { resolve(request.result || null); };
        request.onerror = function () { reject(request.error); };
      });
    });
  }

  function idbPut(id, blob) {
    return openDb().then(function (database) {
      return new Promise(function (resolve, reject) {
        var tx = database.transaction("files", "readwrite");
        tx.objectStore("files").put(blob, id);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error); };
      });
    });
  }

  function idbDelete(id) {
    return openDb().then(function (database) {
      return new Promise(function (resolve, reject) {
        var tx = database.transaction("files", "readwrite");
        tx.objectStore("files").delete(id);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error); };
      });
    });
  }

  function canEdit() {
    return true;
  }

  function loadMaterials(key) {
    return Promise.resolve(normalizeRecord(readMeta()[key]));
  }

  function updateSlot(key, slotId, change) {
    var all = readMeta();
    var record = normalizeRecord(all[key]);
    record[slotId] = change(record[slotId]);
    all[key] = record;
    writeMeta(all);
  }

  function showError(node, text) {
    if (!text) {
      node.hidden = true;
      node.textContent = "";
      return;
    }
    node.hidden = false;
    node.textContent = text;
  }

  function addLinks(key, slotId, raw) {
    var parts = String(raw || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return Promise.resolve("");
    var hrefs = [];
    for (var i = 0; i < parts.length; i += 1) {
      var href = normalizeLink(parts[i]);
      if (!href) return Promise.resolve("Нужна ссылка на сайт: http или https.");
      hrefs.push(href);
    }
    try {
      updateSlot(key, slotId, function (slot) {
        var links = slot.links.slice();
        hrefs.forEach(function (href) {
          links.push({ id: newId(), href: href });
        });
        return { files: slot.files, links: links };
      });
    } catch (error) {
      return Promise.resolve("Не удалось сохранить ссылку.");
    }
    return Promise.resolve("");
  }

  function addFiles(key, material, fileList) {
    var accepted = [];
    var rejected = false;
    var tooBig = false;
    Array.prototype.forEach.call(fileList || [], function (file) {
      if (file.size > 512 * 1024 * 1024) tooBig = true;
      else if (fileAllowed(material.kind, file)) accepted.push(file);
      else rejected = true;
    });
    if (tooBig) return Promise.resolve({ message: "Файл больше 512 МБ." });
    if (!accepted.length) return Promise.resolve({ message: rejectMessage(material.kind) });
    var saved = [];
    var chain = Promise.resolve("");
    accepted.forEach(function (file) {
      chain = chain.then(function (message) {
        if (message) return message;
        var id = newId();
        return idbPut(id, file).then(function () {
          saved.push({ id: id, name: file.name, size: file.size, type: file.type || "" });
          return "";
        }, function () {
          return "Не удалось сохранить файл. В браузере могло не хватить места.";
        });
      });
    });
    return chain.then(function (message) {
      if (saved.length) {
        try {
          updateSlot(key, material.id, function (slot) {
            return { files: slot.files.concat(saved), links: slot.links };
          });
        } catch (error) {
          return { message: "Не удалось сохранить файл." };
        }
      }
      if (!message && rejected) message = rejectMessage(material.kind);
      return { message: message || "" };
    });
  }

  function paintFiles(list, material, data, key, gen, onChange) {
    list.innerHTML = "";
    (data.files || []).forEach(function (meta) {
      var item = el("li", { class: "slot-file" });
      var row = el("div", { class: "slot-row" });
      var playable = isPlayableVideo(meta);
      var pdf = extOf(meta.name) === "pdf" || meta.type === "application/pdf";
      var video = null;
      if (playable) {
        video = el("video", { class: "slot-video", controls: "controls", preload: "metadata" });
        item.appendChild(video);
      }
      var link = el("a", { class: "slot-name", title: meta.name }, [meta.name]);
      if (pdf) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      } else {
        link.setAttribute("download", meta.name);
      }
      idbGet(meta.id).then(function (blob) {
        if (gen !== renderGen || !blob) return;
        var url = URL.createObjectURL(blob);
        objectUrls.push(url);
        if (video) video.src = url;
        link.href = url;
      });
      row.appendChild(link);
      row.appendChild(el("span", { class: "slot-size" }, [formatSize(meta.size)]));
      if (canEdit()) {
        var remove = el("button", { type: "button", class: "slot-remove" }, ["Убрать"]);
        remove.addEventListener("click", function () {
          remove.disabled = true;
          try {
            updateSlot(key, material.id, function (slot) {
              return {
                files: slot.files.filter(function (file) { return file.id !== meta.id; }),
                links: slot.links
              };
            });
          } catch (error) {
            if (gen !== renderGen) return;
            remove.disabled = false;
            onChange("Не удалось убрать файл.");
            return;
          }
          idbDelete(meta.id).then(function () {
            if (gen !== renderGen) return;
            onChange("");
          }, function () {
            if (gen !== renderGen) return;
            onChange("");
          });
        });
        row.appendChild(remove);
      }
      item.appendChild(row);
      list.appendChild(item);
    });
  }

  function paintLinks(list, material, data, key, gen, onChange) {
    list.innerHTML = "";
    (data.links || []).forEach(function (item) {
      var safe = normalizeLink(item.href);
      if (!safe) return;
      var row = el("li", { class: "slot-row" });
      row.appendChild(el("a", {
        href: safe,
        target: "_blank",
        rel: "noopener noreferrer",
        title: safe
      }, [safe]));
      if (canEdit()) {
        var remove = el("button", { type: "button", class: "slot-remove" }, ["Убрать"]);
        remove.addEventListener("click", function () {
          remove.disabled = true;
          try {
            updateSlot(key, material.id, function (slot) {
              return {
                files: slot.files,
                links: slot.links.filter(function (link) { return link.id !== item.id; })
              };
            });
          } catch (error) {
            if (gen !== renderGen) return;
            remove.disabled = false;
            onChange("Не удалось убрать ссылку.");
            return;
          }
          if (gen !== renderGen) return;
          onChange("");
        });
        row.appendChild(remove);
      }
      list.appendChild(row);
    });
  }

  function renderSlot(material, key, gen, data) {
    var slot = el("section", { class: "slot" });
    var files = el("ul", { class: "slot-list" });
    var links = el("ul", { class: "slot-list" });
    var error = el("p", { class: "slot-error" });
    error.hidden = true;
    slot.appendChild(el("h3", {}, [material.title]));
    slot.appendChild(files);

    function reload(message) {
      loadMaterials(key).then(function (record) {
        if (gen !== renderGen) return;
        var fresh = record[material.id];
        paintFiles(files, material, fresh, key, gen, reload);
        paintLinks(links, material, fresh, key, gen, reload);
        showError(error, message);
      }, function () {
        if (gen !== renderGen) return;
        showError(error, message || "Не удалось обновить материалы.");
      });
    }

    if (canEdit()) {
      var input = el("input", { type: "file", multiple: "multiple" });
      if (material.accept) input.setAttribute("accept", material.accept);
      var labelText = document.createTextNode("Добавить файлы");
      var label = el("label", { class: "file-pick" });
      label.appendChild(labelText);
      label.appendChild(input);
      var form = el("form", { class: "slot-link" });
      var linkInput = el("input", {
        type: "text",
        inputmode: "url",
        placeholder: "Ссылка на сторонний ресурс",
        "aria-label": "Ссылка на сторонний ресурс",
        autocomplete: "off",
        spellcheck: "false"
      });
      form.appendChild(linkInput);
      form.appendChild(el("button", { type: "submit" }, ["Добавить"]));
      slot.appendChild(label);
      slot.appendChild(links);
      slot.appendChild(form);
      input.addEventListener("change", function () {
        if (!input.files || !input.files.length) return;
        label.classList.add("is-busy");
        input.disabled = true;
        labelText.data = "Сохраняю…";
        addFiles(key, material, input.files).then(function (result) {
          if (gen !== renderGen) return;
          input.value = "";
          input.disabled = false;
          label.classList.remove("is-busy");
          labelText.data = "Добавить файлы";
          reload(result.message);
        });
      });
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        if (!linkInput.value.trim()) return;
        addLinks(key, material.id, linkInput.value).then(function (message) {
          if (gen !== renderGen) return;
          if (!message) linkInput.value = "";
          reload(message);
        });
      });
    } else {
      slot.appendChild(links);
    }

    slot.appendChild(error);
    paintFiles(files, material, data, key, gen, reload);
    paintLinks(links, material, data, key, gen, reload);
    return slot;
  }

  function renderLesson(ctx) {
    var root = page();
    var key = lessonKey(ctx);
    root.classList.add("lesson");
    root.appendChild(crumbs([
      { href: "#/", label: "Каталог" },
      { href: href(ctx.d.id), label: ctx.d.title },
      { href: href(ctx.d.id, ctx.s.id), label: ctx.s.title },
      { href: href(ctx.d.id, ctx.s.id, ctx.g.id), label: ctx.g.title }
    ]));
    var gen = renderGen;
    root.appendChild(el("p", { class: "kicker" }, ["Урок " + ctx.l.n]));
    root.appendChild(el("h1", {}, [ctx.l.title]));
    root.appendChild(el("h2", { class: "section-label" }, ["Материалы"]));
    var grid = el("div", { class: "slot-grid" });
    root.appendChild(grid);
    var share = el("div", { class: "share" });
    share.appendChild(el("code", { class: "permalink" }, [href(ctx.d.id, ctx.s.id, ctx.g.id, ctx.l.id)]));
    var button = el("button", { class: "copy", type: "button" }, ["Скопировать ссылку"]);
    button.addEventListener("click", function () {
      var url = location.href;
      var done = function (text) {
        button.textContent = text;
        setTimeout(function () {
          button.textContent = "Скопировать ссылку";
        }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () {
          done("Скопировано");
        }, function () {
          done("Скопируйте адрес из строки браузера");
        });
      } else {
        done("Скопируйте адрес из строки браузера");
      }
    });
    share.appendChild(button);
    root.appendChild(share);
    main.appendChild(root);

    function draw(record) {
      if (gen !== renderGen) return;
      grid.innerHTML = "";
      MATERIALS.forEach(function (material) {
        grid.appendChild(renderSlot(material, key, gen, record[material.id]));
      });
    }

    loadMaterials(key).then(draw, function () {
      if (gen !== renderGen) return;
      grid.appendChild(el("p", { class: "lead" }, ["Материалы сейчас не открываются."]));
    });
  }

  function renderSearch(hits) {
    var root = page();
    root.appendChild(el("p", { class: "kicker" }, ["Поиск"]));
    root.appendChild(el("h1", {}, [
      hits.length
        ? hits.length + " " + plural(hits.length, "совпадение", "совпадения", "совпадений")
        : "Ничего не нашлось"
    ]));
    if (!hits.length) {
      root.appendChild(el("p", { class: "lead" }, ["По этому запросу ничего не нашлось."]));
      main.appendChild(root);
      return;
    }
    var last = "";
    var list = null;
    hits.forEach(function (hit) {
      var key = hit.d.id + "/" + hit.s.id;
      if (key !== last) {
        last = key;
        var block = el("section", { class: "subject-block" });
        var heading = el("h2");
        heading.appendChild(el("a", { href: href(hit.d.id, hit.s.id) }, [hit.s.title]));
        block.appendChild(heading);
        list = el("div", { class: "mini-list" });
        block.appendChild(list);
        root.appendChild(block);
      }
      if (hit.type === "lesson") list.appendChild(miniCard(hit.d, hit.s, hit.g, hit.l, true));
      else if (hit.type === "empty-grade") {
        list.appendChild(el("a", { class: "empty-subject", href: href(hit.d.id, hit.s.id, hit.g.id) }, [
          hit.g.title + " — уроков пока нет"
        ]));
      } else {
        list.appendChild(el("a", { class: "empty-subject", href: href(hit.d.id, hit.s.id) }, [
          hit.s.note || "Уроков пока нет"
        ]));
      }
    });
    main.appendChild(root);
  }

  function renderMissing() {
    var root = page();
    root.classList.add("missing");
    root.appendChild(el("p", { class: "kicker" }, ["Каталог"]));
    root.appendChild(el("h1", {}, ["Такой страницы нет"]));
    root.appendChild(el("p", { class: "lead" }, ["Ссылка не совпала ни с одним уроком."]));
    root.appendChild(el("p", {}, [el("a", { href: "#/" }, ["Вернуться в каталог"])]));
    main.appendChild(root);
  }

  function pageTitle(ctx) {
    var base = catalog.title;
    if (searching()) return "Поиск — " + base;
    if (ctx.level === "lesson") return ctx.l.title + " — " + base;
    if (ctx.level === "grade") return ctx.g.title + " · " + ctx.s.title + " — " + base;
    if (ctx.level === "subject") return ctx.s.title + " — " + base;
    if (ctx.level === "dept") return ctx.d.title + " — " + base;
    if (ctx.level === "missing") return "Страница не найдена — " + base;
    return base;
  }

  function ensureOpen(ctx) {
    if (!ctx || !ctx.d || ctx.level === "home" || ctx.level === "missing") return;
    open["d:" + ctx.d.id] = true;
    if (ctx.s) open["s:" + ctx.d.id + "/" + ctx.s.id] = true;
  }

  function render(options) {
    options = options || {};
    renderGen += 1;
    revokeUrls();
    var ctx = resolve();
    if (options.expandPath) ensureOpen(ctx);
    document.title = pageTitle(ctx);
    var mainTop = options.keepMainScroll ? main.scrollTop : 0;
    renderNav(ctx, options.revealCurrent);
    main.innerHTML = "";
    if (searching()) renderSearch(collectHits());
    else if (ctx.level === "home") renderHome();
    else if (ctx.level === "dept") renderDept(ctx);
    else if (ctx.level === "subject") renderSubject(ctx);
    else if (ctx.level === "grade") renderGrade(ctx);
    else if (ctx.level === "lesson") renderLesson(ctx);
    else renderMissing();
    if (options.keepMainScroll) main.scrollTop = mainTop;
    else main.scrollTop = 0;
  }

  function closeNav() {
    shell.classList.remove("nav-open");
    navToggle.setAttribute("aria-expanded", "false");
  }

  document.getElementById("search-form").addEventListener("submit", function (event) {
    event.preventDefault();
  });

  search.addEventListener("input", function () {
    query = search.value;
    clearBtn.hidden = !normalize(query);
    render({ keepMainScroll: false });
  });

  clearBtn.addEventListener("click", function () {
    query = "";
    search.value = "";
    clearBtn.hidden = true;
    search.focus();
    render();
  });

  navToggle.addEventListener("click", function () {
    var opened = shell.classList.toggle("nav-open");
    navToggle.setAttribute("aria-expanded", opened ? "true" : "false");
  });

  backdrop.addEventListener("click", closeNav);

  window.addEventListener("hashchange", function () {
    closeNav();
    render({ expandPath: true, revealCurrent: true });
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    if (shell.classList.contains("nav-open")) {
      closeNav();
      return;
    }
    if (normalize(query)) {
      query = "";
      search.value = "";
      clearBtn.hidden = true;
      render();
    }
  });

  render({ expandPath: true, revealCurrent: true });
})();
