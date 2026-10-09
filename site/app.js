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
    { title: "Презентация", text: "Смотреть в браузере и скачать файл." },
    { title: "Конспект", text: "Текст урока." },
    { title: "Методическая разработка", text: "Как построен урок." },
    { title: "Видео", text: "Запись объяснения." }
  ];

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
    link.appendChild(el("p", { class: "mini-status" }, ["Файлы ещё не приложены"]));
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
      [numbers.lessons, "урок в черновике", "урока в черновике", "уроков в черновике"],
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
    root.appendChild(el("p", { class: "kicker" }, ["Черновик"]));
    root.appendChild(el("h1", {}, [catalog.title]));
    root.appendChild(el("p", { class: "lead" }, [
      "Открытый каталог уроков. На карточке урока четыре места: презентация, конспект, методическая разработка и видео. Полностью внесены планы математики 5 и 6 классов, алгебры, геометрии без профиля 10 и 11 классов, вероятности и статистики, биологии и физики. Остальные предметы пока с отдельными уроками из Structure_test."
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
        ? count + " " + plural(count, "урок", "урока", "уроков") + " в черновике."
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
        ? count + " " + plural(count, "урок", "урока", "уроков") + " в черновике. Список уроков открывается в выбранном классе."
        : "Классы уже стоят в программе. Уроков в черновике пока нет."
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
      root.appendChild(el("p", { class: "lead" }, ["В программе этот класс есть. Уроков в черновике пока нет."]));
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

  function renderLesson(ctx) {
    var root = page();
    root.classList.add("lesson");
    root.appendChild(crumbs([
      { href: "#/", label: "Каталог" },
      { href: href(ctx.d.id), label: ctx.d.title },
      { href: href(ctx.d.id, ctx.s.id), label: ctx.s.title },
      { href: href(ctx.d.id, ctx.s.id, ctx.g.id), label: ctx.g.title }
    ]));
    root.appendChild(el("p", { class: "kicker" }, ["Урок " + ctx.l.n]));
    root.appendChild(el("h1", {}, [ctx.l.title]));
    root.appendChild(el("p", { class: "lead" }, [
      "Файлы к этому уроку ещё не загружены. Ниже места, где они будут стоять."
    ]));
    root.appendChild(el("h2", { class: "section-label" }, ["Материалы"]));
    var grid = el("div", { class: "slot-grid" });
    MATERIALS.forEach(function (material) {
      var slot = el("section", { class: "slot" });
      slot.appendChild(el("h3", {}, [material.title]));
      slot.appendChild(el("p", {}, [material.text]));
      slot.appendChild(el("p", { class: "slot-status" }, ["Пока не добавлено"]));
      grid.appendChild(slot);
    });
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
      root.appendChild(el("p", { class: "lead" }, ["По этому запросу в черновике ничего нет."]));
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
    root.appendChild(el("p", { class: "lead" }, ["Ссылка не совпала ни с одним уроком черновика."]));
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
    if (!ctx || ctx.level === "home" || ctx.level === "missing") return;
    open["d:" + ctx.d.id] = true;
    if (ctx.s) open["s:" + ctx.d.id + "/" + ctx.s.id] = true;
  }

  function render(options) {
    options = options || {};
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
