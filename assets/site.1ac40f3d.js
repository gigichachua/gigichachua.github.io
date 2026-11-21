// The small amount of JavaScript the site uses. Every page still works without it.

// 1. The silent clip on the home page.
//    It plays while it is on screen, unless the visitor's device asks for less motion or for
//    less data. The Pause button in its corner always works.
const clip = document.querySelector('video[data-loop]')
const pauseButton = document.querySelector('[data-loop-toggle]')

if (clip && pauseButton) {
    const wantsLessMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const savesData = Boolean(navigator.connection && navigator.connection.saveData)
    let stoppedByVisitor = wantsLessMotion || savesData

    const play = () => clip.play().catch(() => {}) // a browser may refuse; the picture stays
    const showState = () => {
        pauseButton.textContent = clip.paused ? 'Play' : 'Pause'
        pauseButton.setAttribute('aria-label', clip.paused ? 'Play the clip' : 'Pause the clip')
    }

    pauseButton.hidden = false
    pauseButton.addEventListener('click', () => {
        stoppedByVisitor = !clip.paused
        if (clip.paused) play()
        else clip.pause()
    })
    clip.addEventListener('play', showState)
    clip.addEventListener('pause', showState)
    showState()

    if ('IntersectionObserver' in window) {
        // The browser reports once right after observe(), so this also starts the clip.
        // Later reports stop it while it is scrolled out of view and start it again.
        new IntersectionObserver((reports) => {
            const onScreen = reports[reports.length - 1].isIntersecting
            if (!onScreen) clip.pause()
            else if (!stoppedByVisitor) play()
        }, { threshold: 0.25 }).observe(clip)
    } else if (!stoppedByVisitor) {
        play()
    }
}

// 2. Videos on project pages.
//    The page shows a picture with a play button. The player is put in only when the visitor
//    presses play: the YouTube player for a YouTube video, the browser's own player for one
//    of our video files. Nothing is fetched from YouTube before that.
for (const box of document.querySelectorAll('.video[data-embed], .video[data-video]')) {
    box.querySelector('.video__start').addEventListener('click', (event) => {
        // Ctrl+click, Shift+click and middle click still open the video in a new tab.
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return

        let player
        if (box.dataset.video) {
            player = document.createElement('video')
            player.src = box.dataset.video
            player.controls = true
            player.autoplay = true
            player.playsInline = true
            player.setAttribute('aria-label', box.dataset.title)
        } else {
            const address = new URL(box.dataset.embed)
            address.searchParams.set('autoplay', '1')

            player = document.createElement('iframe')
            player.src = address.href
            player.title = box.dataset.title
            player.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
            player.allowFullscreen = true
            // YouTube refuses to play when the page hides where the request comes from.
            player.referrerPolicy = 'strict-origin-when-cross-origin'
        }

        box.replaceChildren(player)
        player.focus()

        // Cancel the link only now. If anything above failed, the click simply follows the
        // link to the video instead.
        event.preventDefault()
    })
}

// 3. Menu links glide to their part of the page instead of jumping there.
//    The glide itself is one rule in site.css ("html.glide"). It is switched on here, at the
//    visitor's first press of a mouse button, a finger or a key, and not when the page loads.
//    This way a page that is opened at an address like "/#about" appears there at once,
//    without sliding down from the top first.
function allowGlide() {
    document.documentElement.classList.add('glide')
}
for (const firstPress of ['pointerdown', 'keydown']) {
    window.addEventListener(firstPress, allowGlide, { once: true, capture: true })
}

// 4. Pictures on a project page.
//    Pressing a picture shows it large on top of the page, in a viewer with Close, Previous
//    and Next buttons. The visitor never leaves the page. Without JavaScript, a picture stays
//    a plain link to its file.
const pictureLinks = [...document.querySelectorAll('.gallery a')]

// Only on a page with pictures, and only in a browser that knows <dialog> (all since 2022).
if (pictureLinks.length && window.HTMLDialogElement) {
    // The viewer is the browser's own <dialog>. That gives a lot for free: Esc closes it, the
    // page behind it cannot be clicked, and closing puts the keyboard focus back on the
    // picture that was pressed.
    // In the markup below, "autofocus" starts the keyboard on Close (without it the browser
    // would start on the first button, Previous), and aria-live="polite" asks a screen
    // reader to say the new "2 of 3" when the picture changes.
    const viewer = document.createElement('dialog')
    viewer.className = 'viewer'
    viewer.setAttribute('aria-label', 'Picture viewer')
    viewer.innerHTML = `
        <img alt="">
        <div class="viewer__bar">
            <button type="button" data-step="-1">Previous</button>
            <span class="viewer__count" aria-live="polite"></span>
            <button type="button" data-step="1">Next</button>
            <button type="button" autofocus>Close</button>
        </div>`
    document.body.append(viewer)

    const large = viewer.querySelector('img')
    const count = viewer.querySelector('.viewer__count')

    // A project with one picture needs no Previous, Next or "1 of 1".
    const several = pictureLinks.length > 1
    for (const part of viewer.querySelectorAll('[data-step], .viewer__count')) part.hidden = !several

    // Puts one picture into the viewer. After the last picture comes the first one again,
    // and before the first comes the last. The number of pictures is added before "%" for
    // that step back from the first picture: in JavaScript -1 % 3 is -1, but (-1 + 3) % 3
    // is 2, the last picture.
    let current = 0
    function show(index) {
        current = (index + pictureLinks.length) % pictureLinks.length
        const link = pictureLinks[current]
        large.src = link.href
        large.alt = link.querySelector('img').alt
        count.textContent = `${current + 1} of ${pictureLinks.length}`
    }

    for (const [index, link] of pictureLinks.entries()) {
        link.addEventListener('click', (event) => {
            // Ctrl+click (Cmd+click on a Mac), Shift+click, Alt+click and middle click are
            // left to the browser: a new tab, a new window, or saving the picture file.
            if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return

            // In a very low window there is no room to show the picture large: a page that
            // is zoomed in a lot, for example. There the press follows the link to the
            // picture file, which the browser lets the visitor zoom and scroll.
            if (window.matchMedia('(max-height: 16rem)').matches) return

            // A double click is two clicks, and the browser counts them in event.detail:
            // 1, then 2. Only the first click may open the viewer. Otherwise a double click
            // that closes the viewer would open it again, through the picture under the pointer.
            if (event.detail > 1) {
                event.preventDefault()
                return
            }

            // While the viewer is open, the page behind it has no scrollbar (see site.css).
            // Measure the scrollbar first, so the page can keep its place free and not shift:
            // the width of the window with the scrollbar, minus the width of the page without
            // it. Where the scrollbar takes no room, as on phones, the result is 0.
            // setProperty hands the number to site.css, which reads it as var(--scrollbar-width).
            const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
            document.documentElement.style.setProperty('--scrollbar-width', `${scrollbarWidth}px`)

            show(index)
            viewer.showModal()
            // One step in the browser's history, so that the Back button closes the viewer
            // instead of leaving the page (see below). { pictureViewer: true } is a small note
            // kept with that step. The '' is an old "title" that browsers ignore but still want.
            history.pushState({ pictureViewer: true }, '')

            // Cancel the link only now. If anything above failed, the click simply follows
            // the link to the picture instead.
            event.preventDefault()
        })
    }

    // Inside the viewer: Previous and Next change the picture. A press anywhere else closes
    // it: the Close button, the picture itself, or the dark area around it.
    viewer.addEventListener('click', (event) => {
        const button = event.target.closest('button')
        // data-step is text ("-1" or "1"). Number() makes it a number, so that "+" adds it.
        if (button && button.dataset.step) show(current + Number(button.dataset.step))
        // The second click of a double click on a picture lands here, on the viewer that its
        // first click has just opened. It must not close the viewer again.
        else if (event.detail !== 2) viewer.close()
    })

    // The left and right arrow keys change the picture too.
    viewer.addEventListener('keydown', (event) => {
        // A key that is held down repeats itself many times a second. Only the first press
        // counts. Otherwise a held arrow key races through the pictures, and an Enter that
        // is held a little too long presses Close right after it opened the viewer.
        if (event.repeat) {
            if (event.key === 'Enter') event.preventDefault()
            return
        }
        if (!several) return
        if (event.key === 'ArrowLeft') show(current - 1)
        if (event.key === 'ArrowRight') show(current + 1)
    })

    // The browser's Back and Forward buttons.
    // Opening the viewer added one step to the browser's history. When the visitor presses
    // Back, the browser goes that step back and tells the page ("popstate"), and the page
    // closes the viewer.
    // The viewer's step is never deleted, because a page cannot do that. After a close it
    // stays ahead of the page, where the Forward button leads. There is nothing to show on
    // it, so if the visitor goes Forward onto it, the page goes back off it again.
    window.addEventListener('popstate', () => {
        if (viewer.open) viewer.close()
        else if (history.state && history.state.pictureViewer) history.back()
    })

    // "close" comes after every way of closing, also after the Back button. history.state is
    // the note of the step the browser is on right now. If that is still the viewer's step
    // (Esc, the Close button or a click closed the viewer), the page goes the step back
    // itself, so the next press of Back leaves the page as usual. After the Back button the
    // browser has left that step already, and going back once more would leave the page.
    // That is what the "if" is for.
    viewer.addEventListener('close', () => {
        if (history.state && history.state.pictureViewer) history.back()
    })

    // If the page was reloaded while the viewer was open, the browser still remembers the
    // viewer's step. Turn it into a normal step.
    if (history.state && history.state.pictureViewer) history.replaceState(null, '')
}
