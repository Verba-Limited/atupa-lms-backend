#!/usr/bin/env python3
"""Generates the ATUPA LMS Postman collection + environments.

Run:  python3 postman/build-collection.py
The collection is ordered so "Run collection" works end-to-end on a freshly
seeded database: each request saves the ids/tokens the next ones need.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
TOKENS = {
    "none": None,
    "admin": "adminToken",
    "learner": "learnerToken",
    "learner2": "learner2Token",
    "parent": "parentToken",
    "teacher": "teacherToken",
    "school": "schoolAdminToken",
}


def req(name, method, path, *, auth="none", body=None, expect=(200,), save=None,
        tests=None, pre=None, desc=None, query=None):
    """save: {var: 'js expression using json'}"""
    test_lines = [
        "const json = pm.response.json ? (() => { try { return pm.response.json(); } catch (e) { return {}; } })() : {};",
        f"pm.test('status is {' or '.join(map(str, expect))}', () => pm.expect(pm.response.code).to.be.oneOf({list(expect)}));",
    ]
    for var, expr in (save or {}).items():
        test_lines.append(
            f"try {{ const v = {expr}; if (v !== undefined && v !== null) pm.collectionVariables.set('{var}', typeof v === 'string' ? v : JSON.stringify(v)); }} catch (e) {{}}"
        )
    test_lines += tests or []
    url = "{{baseUrl}}" + path
    if query:
        url += "?" + "&".join(f"{k}={v}" for k, v in query.items())
    request = {
        "method": method,
        "header": [{"key": "Content-Type", "value": "application/json"}] if body is not None else [],
        "url": url,
    }
    token = TOKENS[auth]
    request["auth"] = (
        {"type": "bearer", "bearer": [{"key": "token", "value": "{{%s}}" % token, "type": "string"}]}
        if token else {"type": "noauth"}
    )
    if body is not None:
        request["body"] = {
            "mode": "raw",
            "raw": body if isinstance(body, str) else json.dumps(body, indent=2, ensure_ascii=False),
            "options": {"raw": {"language": "json"}},
        }
    if desc:
        request["description"] = desc
    events = [{"listen": "test", "script": {"type": "text/javascript", "exec": test_lines}}]
    if pre:
        events.insert(0, {"listen": "prerequest", "script": {"type": "text/javascript", "exec": pre}})
    return {"name": name, "event": events, "request": request}


def folder(name, desc, items):
    return {"name": name, "description": desc, "item": items}


def session(prefix):
    """Saves token + user id from an auth response."""
    return {f"{prefix}Token": "json.data.accessToken", f"{prefix}Id": "json.data.user.id"}


LEARNER = {
    "email": "learner.{{runId}}@atupa.test",
    "password": "Passw0rd!",
    "role": "learner",
    "firstName": "Ada",
    "lastName": "Obi",
    "dateOfBirth": "2014-05-20",
    "preferredLanguageCode": "yoruba",
}

items = []

items.append(folder("00 Health & public", "No auth needed.", [
    req("Health", "GET", "/health"),
    req("Languages", "GET", "/languages", save={"languagesCount": "json.data.length"}),
    req("Subscription plans", "GET", "/subscriptions/plans"),
]))

items.append(folder("01 Auth", "Self-registration (learner, parent, teacher), login, refresh, profile, password reset.", [
    req("Register learner", "POST", "/auth/register", body=LEARNER, expect=(201,),
        save={**session("learner"), "learnerRefreshToken": "json.data.refreshToken"}),
    req("Register second learner", "POST", "/auth/register", expect=(201,), save=session("learner2"),
        body={**LEARNER, "email": "learner2.{{runId}}@atupa.test", "firstName": "Chidi", "preferredLanguageCode": "igbo"}),
    req("Register parent", "POST", "/auth/register", expect=(201,), save=session("parent"),
        body={"email": "parent.{{runId}}@atupa.test", "password": "Passw0rd!", "role": "parent",
              "firstName": "Ngozi", "lastName": "Obi", "phone": "+2348012345678"}),
    req("Register teacher", "POST", "/auth/register", expect=(201,), save=session("teacher"),
        body={"email": "teacher.{{runId}}@atupa.test", "password": "Passw0rd!", "role": "teacher",
              "firstName": "Tunde", "lastName": "Bello", "phone": "+2348098765432",
              "teachingExperienceYears": 5, "languageSpecializations": ["yoruba"]}),
    req("Login super admin", "POST", "/auth/login", expect=(200,), save=session("admin"),
        body={"email": "{{adminEmail}}", "password": "{{adminPassword}}"},
        desc="Uses SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD from the server env."),
    req("Login learner", "POST", "/auth/login", expect=(200,),
        save={**session("learner"), "learnerRefreshToken": "json.data.refreshToken"},
        body={"email": "learner.{{runId}}@atupa.test", "password": "Passw0rd!"}),
    req("Refresh token (rotates)", "POST", "/auth/refresh", expect=(200,),
        save={"learnerToken": "json.data.accessToken", "learnerRefreshToken": "json.data.refreshToken"},
        body={"refreshToken": "{{learnerRefreshToken}}"},
        desc="Returns a new access + refresh token. Reusing an old refresh token logs the user out everywhere."),
    req("Me", "GET", "/users/me", auth="learner"),
    req("Update my profile", "PATCH", "/users/me", auth="learner",
        body={"preferredLanguageCode": "yoruba", "lastName": "Obi"}),
    req("Forgot password", "POST", "/auth/password/forgot", expect=(200,),
        body={"email": "learner.{{runId}}@atupa.test"},
        desc="Always 200. The email (or dev log) contains the reset link with a 64-char token for POST /auth/password/reset."),
]))

items.append(folder("02 Admin · users", "Super admin user management.", [
    req("List users", "GET", "/admin/users", auth="admin", query={"page": 1, "limit": 20}),
    req("Search users by role", "GET", "/admin/users", auth="admin", query={"role": "learner", "q": "Ada"}),
    req("Invite content creator", "POST", "/admin/users", auth="admin", expect=(201,),
        save={"creatorId": "json.data.id"},
        body={"email": "creator.{{runId}}@atupa.test", "role": "content_creator", "firstName": "Kemi", "lastName": "Ade"},
        desc="The invitee gets an email with a set-password link."),
    req("Get user", "GET", "/admin/users/{{learner2Id}}", auth="admin"),
    req("Deactivate / reactivate user", "PATCH", "/admin/users/{{creatorId}}", auth="admin",
        body={"isActive": True}),
]))

items.append(folder("03 Schools", "School registration, members, join codes, settings.", [
    req("Register school (public)", "POST", "/schools/register", expect=(201,),
        save={"schoolAdminToken": "json.data.session.accessToken", "schoolId": "json.data.school.id",
              "schoolJoinCode": "json.data.school.joinCode"},
        body={"name": "Lagos Model College {{runId}}", "email": "info.{{runId}}@school.test",
              "phone": "+2348011111111", "address": "12 Marina, Lagos", "region": "Lagos",
              "declaredStudentCount": 450,
              "admin": {"email": "schooladmin.{{runId}}@atupa.test", "password": "Passw0rd!",
                        "firstName": "Bola", "lastName": "Ade"}}),
    req("My school", "GET", "/schools/mine", auth="school", save={"schoolJoinCode": "json.data.joinCode"}),
    req("Update school settings", "PATCH", "/schools/{{schoolId}}", auth="school",
        body={"settings": {"leaderboardsEnabled": True, "showLearnerNamesOnLeaderboards": False}}),
    req("Teacher joins school with code", "POST", "/schools/join", auth="teacher", body={"joinCode": "{{schoolJoinCode}}"}),
    req("Learner joins school with code", "POST", "/schools/join", auth="learner", body={"joinCode": "{{schoolJoinCode}}"}),
    req("Invite a student (school admin)", "POST", "/schools/{{schoolId}}/members", auth="school", expect=(201,),
        save={"invitedStudentId": "json.data.id"},
        body={"role": "learner", "email": "student.{{runId}}@atupa.test", "firstName": "Musa",
              "lastName": "Bello", "dateOfBirth": "2013-03-01"}),
    req("List school members", "GET", "/schools/{{schoolId}}/members", auth="school", query={"role": "learner"}),
    req("Rotate join code", "POST", "/schools/{{schoolId}}/join-code/rotate", auth="school",
        save={"schoolJoinCode": "json.data.joinCode"}),
    req("List schools (super admin)", "GET", "/schools", auth="admin"),
]))

items.append(folder("04 Catalog · browse", "Public course browsing. Saves the seeded Yoruba Beginner course.", [
    req("Courses (filter)", "GET", "/courses", query={"languageCode": "yoruba", "level": "beginner"},
        save={"courseId": "json.data.items[0].id"}),
    req("Courses (all, paginated)", "GET", "/courses", query={"page": 1, "limit": 10}),
    req("Course outline", "GET", "/courses/{{courseId}}",
        save={"lessonId": "json.data.modules[0].lessons[0].id",
              "lesson2Id": "json.data.modules[1].lessons[0].id",
              "quizId": "json.data.modules[0].quizzes[0].id"},
        tests=["pm.test('no answers exposed', () => pm.expect(pm.response.text()).to.not.include('correctAnswer'));"]),
]))

items.append(folder("05 Authoring (CMS)", "Teacher creates a course end-to-end; admin manages languages and library.", [
    req("Create course (teacher)", "POST", "/authoring/courses", auth="teacher", expect=(201,),
        save={"myCourseId": "json.data.id"},
        body={"languageCode": "yoruba", "level": "beginner", "title": "Primary 5 Yoruba {{runId}}",
              "description": "Greetings, numbers and animals", "courseType": "language", "ageGroup": "children",
              "durationMinutes": 90, "isPremium": False, "tags": ["greetings"]}),
    req("Create module", "POST", "/authoring/courses/{{myCourseId}}/modules", auth="teacher", expect=(201,),
        save={"myModuleId": "json.data.id"}, body={"title": "Module 1: Greetings"}),
    req("Create lesson", "POST", "/authoring/modules/{{myModuleId}}/lessons", auth="teacher", expect=(201,),
        save={"myLessonId": "json.data.id"},
        body={"title": "Basic Greetings", "estimatedMinutes": 10,
              "blocks": [{"type": "text", "content": "English: Good morning\nYoruba: Ẹ kú àárọ̀"},
                         {"type": "cultural_note", "content": "Kneel or prostrate when greeting elders."}],
              "vocabulary": ["Ẹ kú àárọ̀"], "pronunciationNotes": ["eh-koo-ah-ah-raw"],
              "culturalNotes": ["Greetings depend on time of day."], "gamecardCodes": ["YOR-LION"]}),
    req("Create activity (multiple choice)", "POST", "/authoring/lessons/{{myLessonId}}/activities", auth="teacher",
        expect=(201,), save={"myActivityId": "json.data.id"},
        body={"type": "multiple_choice", "prompt": "Which means 'Good morning'?",
              "payload": {"choices": ["Ẹ kú àárọ̀", "Ẹ ṣé"]}, "solution": "Ẹ kú àárọ̀",
              "feedback": {"correct": "Well done!", "incorrect": "Try again."}}),
    req("Create quiz", "POST", "/authoring/courses/{{myCourseId}}/quizzes", auth="teacher", expect=(201,),
        save={"myQuizId": "json.data.id"},
        body={"lessonId": "{{myLessonId}}", "title": "Greetings check", "passScorePercent": 70,
              "timerSeconds": 300, "randomizeQuestions": True, "maxAttempts": 3, "allowReview": True,
              "questions": [
                  {"type": "multiple_choice", "prompt": "Good morning?", "options": {"choices": ["Ẹ kú àárọ̀", "Ẹ ṣé"]},
                   "correctAnswer": "Ẹ kú àárọ̀", "explanation": "Morning greeting."},
                  {"type": "true_false", "prompt": "'Ẹ ṣé' means thank you", "correctAnswer": "true"},
                  {"type": "translation", "prompt": "Translate 'Thank you'", "correctAnswer": "Ẹ ṣé",
                   "acceptedAnswers": ["E se"]}]}),
    req("Publish lesson", "POST", "/authoring/lessons/{{myLessonId}}/publish", auth="teacher"),
    req("Publish course", "POST", "/authoring/courses/{{myCourseId}}/publish", auth="teacher"),
    req("My courses", "GET", "/authoring/courses", auth="teacher"),
    req("Course tree (with answers)", "GET", "/authoring/courses/{{myCourseId}}", auth="teacher"),
    req("Update course", "PATCH", "/authoring/courses/{{myCourseId}}", auth="teacher",
        body={"description": "Updated description"}),
    req("Get quiz (author view)", "GET", "/authoring/quizzes/{{myQuizId}}", auth="teacher"),
    req("Create language (admin)", "POST", "/languages", auth="admin", expect=(201, 409),
        body={"code": "edo{{runId}}", "name": "Edo", "nativeName": "Ẹdo"},
        desc="Adding a language is just data. 409 if it already exists."),
    req("All languages (admin)", "GET", "/admin/languages", auth="admin"),
    req("Create vocabulary", "POST", "/authoring/vocabulary", auth="admin", expect=(201,),
        save={"vocabId": "json.data.id"},
        body={"languageCode": "yoruba", "term": "Erin", "meaning": "Elephant", "conceptKey": "elephant{{runId}}",
              "category": "animals", "level": "beginner"}),
    req("Create cultural topic", "POST", "/authoring/cultural-topics", auth="admin", expect=(201,),
        save={"topicId": "json.data.id"},
        body={"title": "Yoruba naming ceremony", "category": "names", "languageCode": "yoruba",
              "summary": "Ìsọmọlórúkọ", "status": "published",
              "blocks": [{"type": "text", "content": "Babies are named on the 7th or 8th day."}]}),
    req("Create game", "POST", "/authoring/games", auth="admin", expect=(201,), save={"gameId": "json.data.id"},
        body={"title": "Animal Match", "gameType": "web", "languageCodes": ["yoruba"],
              "conceptKeys": ["lion"], "status": "published"}),
    req("Create GameCard", "POST", "/authoring/gamecards", auth="admin", expect=(201,),
        save={"cardCode": "json.data.code"},
        body={"code": "YOR-T{{runId}}", "conceptKey": "lion", "languageCode": "yoruba", "title": "Kìnnìún",
              "challenge": {"prompt": "Say 'lion' in Yoruba", "choices": ["Kìnnìún", "Ajá"], "answer": "Kìnnìún"}}),
    req("GameCard printable QR", "GET", "/authoring/gamecards/{{cardCode}}/qr", auth="admin"),
    req("List GameCards", "GET", "/authoring/gamecards", auth="admin"),
]))

items.append(folder("06 Library · browse", "Vocabulary, cultural topics and games (public).", [
    req("Vocabulary", "GET", "/vocabulary", query={"languageCode": "yoruba"}),
    req("Concept in all languages (lion)", "GET", "/vocabulary/concepts/lion"),
    req("Cultural topics", "GET", "/cultural-topics"),
    req("Cultural topic", "GET", "/cultural-topics/{{topicId}}"),
    req("Games", "GET", "/games"),
]))

items.append(folder("07 Media", "Cloudinary uploads. 'Server upload' needs a file chosen in the Body tab.", [
    req("Request upload ticket (direct to Cloudinary)", "POST", "/media/uploads", auth="teacher", expect=(201,),
        body={"kind": "image", "purpose": "content"},
        desc="mode=direct: POST the file + `fields` to `uploadUrl` (field name `file`), then call Confirm with the returned public_id. mode=server: use 'Server upload'."),
    req("Confirm direct upload", "POST", "/media/uploads/confirm", auth="teacher", expect=(201, 403, 404),
        body={"publicId": "atupa-lms/content/image/{{teacherId}}/REPLACE_WITH_PUBLIC_ID", "kind": "image", "purpose": "content"},
        desc="Replace publicId with the value Cloudinary returned."),
    {
        "name": "Server upload (choose a file)",
        "request": {
            "method": "POST",
            "auth": {"type": "bearer", "bearer": [{"key": "token", "value": "{{teacherToken}}", "type": "string"}]},
            "url": "{{baseUrl}}/media/upload",
            "body": {"mode": "formdata", "formdata": [
                {"key": "file", "type": "file", "src": []},
                {"key": "purpose", "value": "content", "type": "text"}]},
            "description": "Pick an image/audio/video (≤25MB) for `file` before sending.",
        },
    },
    req("My media", "GET", "/media", auth="teacher"),
]))

ANSWER_SCRIPT = [
    "// Builds answers for the seeded Yoruba Beginner quiz from the started attempt.",
    "const qs = JSON.parse(pm.collectionVariables.get('quizQuestions') || '[]');",
    "const answers = {};",
    "qs.forEach(q => { answers[q.id] = q.type === 'translation' ? 'e se' : (q.options && q.options.choices ? q.options.choices[0] : ''); });",
    "pm.collectionVariables.set('quizAnswers', JSON.stringify(answers));",
]

items.append(folder("08 Learning & progress (learner)", "Full learner flow on the seeded Yoruba Beginner course, ending in a certificate.", [
    req("Enroll", "POST", "/progress/courses/{{courseId}}/enroll", auth="learner", expect=(201,)),
    req("Open lesson", "GET", "/learning/lessons/{{lessonId}}", auth="learner",
        save={"activityId": "json.data.activities[0].id", "activityChoice": "json.data.activities[0].payload.choices[0]"}),
    req("Submit activity", "POST", "/learning/activities/{{activityId}}/submit", auth="learner",
        body={"response": "{{activityChoice}}"}),
    req("Save lesson position", "PUT", "/progress/lessons/{{lessonId}}/position", auth="learner",
        body={"progressPercent": 60, "lastBlockIndex": 1}),
    req("Continue where I stopped", "GET", "/progress/continue", auth="learner"),
    req("Complete lesson 1", "POST", "/progress/lessons/{{lessonId}}/complete", auth="learner"),
    req("Complete lesson 2", "POST", "/progress/lessons/{{lesson2Id}}/complete", auth="learner"),
    req("Start quiz attempt", "POST", "/learning/quizzes/{{quizId}}/attempts", auth="learner", expect=(201,),
        save={"attemptId": "json.data.attemptId", "quizQuestions": "json.data.questions"}),
    req("Submit quiz attempt", "POST", "/learning/attempts/{{attemptId}}/submit", auth="learner",
        pre=ANSWER_SCRIPT, body='{\n  "answers": {{quizAnswers}}\n}',
        tests=["pm.test('passed', () => pm.expect(json.data.passed).to.eql(true));"]),
    req("Review attempt", "GET", "/learning/attempts/{{attemptId}}/review", auth="learner"),
    req("My attempts", "GET", "/learning/attempts", auth="learner"),
    req("Course progress", "GET", "/progress/courses/{{courseId}}", auth="learner",
        tests=["pm.test('course complete', () => pm.expect(json.data.complete).to.eql(true));"]),
    req("My courses", "GET", "/progress/courses", auth="learner"),
    req("Learning-time heartbeat", "POST", "/progress/heartbeat", auth="learner", body={"seconds": 60}),
    req("Complete cultural topic", "POST", "/progress/cultural-topics/{{topicId}}/complete", auth="learner"),
    req("Stats (points, streak)", "GET", "/progress/stats", auth="learner"),
    req("Badges", "GET", "/progress/badges", auth="learner"),
    req("Recent activity", "GET", "/progress/activity", auth="learner", query={"limit": 10}),
    req("Quiz results", "GET", "/progress/quiz-results", auth="learner"),
]))

items.append(folder("09 Certificates", "Issued automatically on course completion.", [
    req("My certificates", "GET", "/certificates/mine", auth="learner",
        save={"certificateId": "json.data[0].id", "verificationCode": "json.data[0].verificationCode"},
        tests=["pm.test('certificate issued', () => pm.expect(json.data.length).to.be.above(0));"]),
    req("Certificate detail (with QR)", "GET", "/certificates/{{certificateId}}", auth="learner"),
    req("Verify certificate (public)", "GET", "/certificates/verify/{{verificationCode}}"),
    req("All certificates (admin)", "GET", "/certificates", auth="admin"),
]))

items.append(folder("10 GameCard & games", "Scan cards, answer challenges, report game sessions.", [
    req("Card lookup", "GET", "/gamecard/cards/YOR-LION", auth="learner"),
    req("Scan card", "POST", "/gamecard/scan", auth="learner", body={"code": "YOR-LION"}),
    req("Answer card challenge", "POST", "/gamecard/cards/YOR-LION/challenge", auth="learner",
        body={"answer": "Kìnnìún"}),
    req("Report game session", "POST", "/games/{{gameId}}/sessions", auth="learner", expect=(201,),
        body={"scorePercent": 80, "durationSeconds": 240}),
    req("My plays", "GET", "/gamecard/plays", auth="learner"),
]))

items.append(folder("11 Parents", "Learner creates a code; parent links with it.", [
    req("Learner: create link code", "POST", "/parents/link-codes", auth="learner", expect=(201,),
        save={"linkCode": "json.data.code"}),
    req("Parent: link child", "POST", "/parents/children", auth="parent", expect=(201,), body={"code": "{{linkCode}}"}),
    req("Parent: children", "GET", "/parents/children", auth="parent"),
    req("Parent dashboard", "GET", "/dashboards/parent", auth="parent"),
    req("Child dashboard", "GET", "/dashboards/children/{{learnerId}}", auth="parent"),
]))

items.append(folder("12 Classes", "Teacher class in the school; learner was added via school membership.", [
    req("Create class", "POST", "/classes", auth="teacher", expect=(201,),
        save={"classId": "json.data.id", "classJoinCode": "json.data.joinCode"},
        body={"name": "Primary 5 Yoruba", "languageCode": "yoruba"}),
    req("Add students", "POST", "/classes/{{classId}}/students", auth="teacher", expect=(201,),
        body={"studentIds": ["{{learnerId}}"]}),
    req("Assign course to class", "POST", "/classes/{{classId}}/courses/{{courseId}}", auth="teacher", expect=(201,)),
    req("Class detail", "GET", "/classes/{{classId}}", auth="teacher"),
    req("Update class", "PATCH", "/classes/{{classId}}", auth="teacher", body={"description": "Mondays 10am"}),
    req("Post announcement", "POST", "/classes/{{classId}}/announcements", auth="teacher", expect=(201,),
        body={"title": "Quiz on Friday", "body": "Revise greetings."}),
    req("My classes (teacher)", "GET", "/classes", auth="teacher"),
    req("My classes (learner)", "GET", "/classes", auth="learner"),
    req("School classes (school admin)", "GET", "/classes", auth="school"),
]))

items.append(folder("13 Assignments", "Assigned → Started → Submitted → Reviewed → Completed.", [
    req("Create assignment", "POST", "/assignments", auth="teacher", expect=(201,), save={"assignmentId": "json.data.id"},
        body={"classroomId": "{{classId}}", "title": "Write about your family", "type": "written_work",
              "instructions": "5 sentences in Yoruba", "maxScore": 10}),
    req("Create lesson assignment (auto-completes)", "POST", "/assignments", auth="teacher", expect=(201,),
        body={"classroomId": "{{classId}}", "title": "Finish Basic Greetings", "type": "lesson", "targetId": "{{lessonId}}"}),
    req("Learner: my assignments", "GET", "/assignments/mine", auth="learner"),
    req("Learner: start", "POST", "/assignments/{{assignmentId}}/start", auth="learner"),
    req("Learner: submit", "POST", "/assignments/{{assignmentId}}/submit", auth="learner",
        body={"text": "Orúkọ mi ni Ada. Mo ní àbúrò méjì..."}),
    req("Teacher: review", "POST", "/assignments/{{assignmentId}}/submissions/{{learnerId}}/review", auth="teacher",
        body={"score": 9, "feedback": "Ó dára púpọ̀!", "complete": True}),
    req("Assignment detail (teacher)", "GET", "/assignments/{{assignmentId}}", auth="teacher"),
    req("Class assignments", "GET", "/assignments/classes/{{classId}}", auth="teacher"),
]))

items.append(folder("14 Notifications", "In-app notifications created by events.", [
    req("Learner notifications", "GET", "/notifications", auth="learner"),
    req("Parent notifications", "GET", "/notifications", auth="parent"),
    req("Unread count", "GET", "/notifications/unread-count", auth="learner"),
    req("Mark all read", "PATCH", "/notifications/read-all", auth="learner"),
]))

items.append(folder("15 Search", "Courses, lessons, languages, vocabulary, cultural topics, games.", [
    req("Search everything", "GET", "/search", query={"q": "greet"}),
    req("Search with filters", "GET", "/search",
        query={"q": "lion", "types": "vocabulary,games,lessons", "languageCode": "yoruba", "level": "beginner"}),
]))

items.append(folder("16 Dashboards & reports", "Role dashboards, reports and leaderboards.", [
    req("Learner dashboard", "GET", "/dashboards/learner", auth="learner"),
    req("Teacher dashboard", "GET", "/dashboards/teacher", auth="teacher"),
    req("School dashboard", "GET", "/dashboards/school", auth="school"),
    req("Admin dashboard", "GET", "/dashboards/admin", auth="admin"),
    req("Learner report (teacher)", "GET", "/reports/learners/{{learnerId}}", auth="teacher"),
    req("Class report", "GET", "/reports/classes/{{classId}}", auth="teacher"),
    req("School report", "GET", "/reports/schools/{{schoolId}}", auth="school"),
    req("Class leaderboard (weekly)", "GET", "/leaderboards", auth="learner",
        query={"scope": "class", "classId": "{{classId}}", "period": "week"}),
    req("Global leaderboard", "GET", "/leaderboards", auth="learner", query={"scope": "global", "period": "all"}),
]))

items.append(folder("17 Subscriptions & payments", "Paystack. Checkout returns 503 until PAYSTACK_SECRET_KEY is set.", [
    req("My subscription", "GET", "/subscriptions/mine", auth="learner"),
    req("Checkout Individual Premium", "POST", "/subscriptions/checkout", auth="learner", expect=(201, 503),
        save={"paymentReference": "json.data.reference"},
        body={"planCode": "individual_premium"},
        desc="Open data.authorizationUrl to pay with a Paystack test card, then call Verify."),
    req("Verify payment", "GET", "/subscriptions/payments/{{paymentReference}}/verify", auth="learner",
        expect=(200, 404, 503)),
    req("School plan checkout (school admin)", "POST", "/subscriptions/checkout", auth="school", expect=(201, 503),
        body={"planCode": "school"}),
    req("Payments (admin)", "GET", "/subscriptions/payments", auth="admin"),
]))

items.append(folder("18 Security checks (expected failures)", "Each request should be rejected.", [
    req("Self-register as super_admin → 400", "POST", "/auth/register", expect=(400,),
        body={"email": "evil.{{runId}}@atupa.test", "password": "Passw0rd!", "role": "super_admin", "firstName": "E"}),
    req("No token → 401", "GET", "/users/me", expect=(401,)),
    req("Learner on admin route → 403", "GET", "/admin/users", auth="learner", expect=(403,)),
    req("Other learner's report → 403", "GET", "/reports/learners/{{learnerId}}", auth="learner2", expect=(403,)),
    req("Malformed id → 400", "GET", "/courses/not-an-id", expect=(400,)),
    req("Unsigned Paystack webhook → 401", "POST", "/subscriptions/webhooks/paystack", expect=(401,),
        body={"event": "charge.success", "data": {"reference": "fake"}}),
    req("Self-issue certificate → 404 (removed)", "POST", "/certificates/issue", auth="learner", expect=(404,),
        body={"courseId": "x"}),
    req("Reuse link code → 400", "POST", "/parents/children", auth="parent", expect=(400,), body={"code": "{{linkCode}}"}),
]))

items.append(folder("19 Session end", "", [
    req("Logout learner", "POST", "/auth/logout", auth="learner"),
]))

variables = [{"key": k, "value": ""} for k in [
    "runId", "learnerToken", "learnerId", "learnerRefreshToken", "learner2Token", "learner2Id",
    "parentToken", "parentId", "teacherToken", "teacherId", "adminToken", "adminId", "schoolAdminToken",
    "schoolId", "schoolJoinCode", "courseId", "lessonId", "lesson2Id", "quizId", "activityId", "activityChoice",
    "attemptId", "quizQuestions", "quizAnswers", "myCourseId", "myModuleId", "myLessonId", "myActivityId",
    "myQuizId", "vocabId", "topicId", "gameId", "cardCode", "certificateId", "verificationCode", "linkCode",
    "classId", "classJoinCode", "assignmentId", "paymentReference", "creatorId", "invitedStudentId"]]

collection = {
    "info": {
        "name": "ATUPA LMS API",
        "description": (
            "End-to-end collection for the ATUPA LMS backend.\n\n"
            "1. Import the collection and an environment (Local or Render).\n"
            "2. Set `adminEmail` / `adminPassword` in the environment to the server's SUPER_ADMIN_* values.\n"
            "3. Run the whole collection (Runner) or go folder by folder. Requests save tokens and ids "
            "in collection variables for later requests. A new `runId` per run keeps emails unique.\n\n"
            "Folder 08 assumes the seeded demo course (SEED_DEMO_CONTENT=true)."
        ),
        "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    "event": [{
        "listen": "prerequest",
        "script": {"type": "text/javascript", "exec": [
            "if (!pm.collectionVariables.get('runId') || pm.info.requestName === 'Health') {",
            "  pm.collectionVariables.set('runId', String(Date.now()).slice(-8));",
            "}",
        ]},
    }],
    "variable": variables,
    "item": items,
}


def env(name, base_url, email, password):
    return {
        "name": name,
        "values": [
            {"key": "baseUrl", "value": base_url, "enabled": True},
            {"key": "adminEmail", "value": email, "enabled": True},
            {"key": "adminPassword", "value": password, "type": "secret", "enabled": True},
        ],
        "_postman_variable_scope": "environment",
    }


with open(os.path.join(HERE, "ATUPA-LMS.postman_collection.json"), "w") as f:
    json.dump(collection, f, indent=2, ensure_ascii=False)
with open(os.path.join(HERE, "ATUPA-LMS.local.postman_environment.json"), "w") as f:
    json.dump(env("ATUPA LMS · Local", "http://localhost:4000/api/v1", "admin@atupa.test", "AdminPass123"), f, indent=2)
with open(os.path.join(HERE, "ATUPA-LMS.render.postman_environment.json"), "w") as f:
    json.dump(env("ATUPA LMS · Render", "https://atupa-lms-api.onrender.com/api/v1", "", ""), f, indent=2)

count = sum(len(f["item"]) for f in items)
print(f"Wrote collection with {len(items)} folders and {count} requests")
