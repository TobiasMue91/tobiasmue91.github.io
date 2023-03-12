import {initializeApp} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import {
    doc,
    getDoc,
    setDoc,
    getFirestore
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";

import {getAuth, signInAnonymously} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-auth.js";

const app = initializeApp({
    apiKey: "AIzaSyBJs3yjQtwHmyi6dDrkSt9IGMzAXuQE1Ms",
    authDomain: "ball-bouncing-game.firebaseapp.com",
    databaseURL: "https://ball-bouncing-game-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "ball-bouncing-game",
    storageBucket: "ball-bouncing-game.appspot.com",
    messagingSenderId: "274565600949",
    appId: "1:274565600949:web:0c0cd51a223ec0226550fc"
});

const auth = getAuth();

await signInAnonymously(auth)
    .then(() => {
        console.log("Signed in anonymously");
    })
    .catch((error) => {
        console.error("Anonymous authentication failed:", error);
    });

const gameCards = document.querySelectorAll(".game-card");

gameCards.forEach((card) => {
    const gameLink = card.querySelector("a").getAttribute('href').replace('/', '-');

    const ratingContainer = document.createElement("div");
    ratingContainer.classList.add("rating-container");

    const stars = Array.from({length: 5}, (_, i) => {
        const star = document.createElement("span");
        star.classList.add("star");
        const rating = i + 1;
        star.dataset.rating = rating;
        star.title = `Vote ${rating}★`;
        star.innerHTML = "★";
        ratingContainer.appendChild(star);
        return star;
    });

    const ratingValue = document.createElement("span");
    ratingValue.classList.add("rating-value");
    ratingValue.innerHTML = "-";

    ratingContainer.appendChild(ratingValue);

    card.appendChild(ratingContainer);

    const handleRatingHover = (event) => {
        const target = event.target;
        if (!target || !target.dataset) {
            return;
        }
        const rating = parseFloat(target.dataset.rating);
        const ratingString = `${rating.toFixed(1)} / 5.0`;
        ratingValue.innerHTML = ratingString;
        stars.forEach((star) => {
            const isFilled = parseFloat(star.dataset.rating) <= rating;
            star.classList.toggle("filled", isFilled);
        });
    };

    const handleRatingClick = (event) => {
        try {
            const target = event.target;
            const rating = parseFloat(target.dataset.rating);
            const gameDocRef = doc(getFirestore(), "games", gameLink);

            getDoc(gameDocRef).then((doc) => {
                const data = doc.data();
                const currentRating = data ? data.rating : 0;
                const ratingCount = data ? data.count : 0;
                const newRating = (currentRating * ratingCount + rating) / (ratingCount + 1);
                if (isNaN(newRating) || isNaN(ratingCount)) {
                    return;
                }
                setDoc(gameDocRef, {rating: newRating, count: ratingCount + 1});
                handleRatingHover(event);
                ratingValue.dataset.rating = newRating.toFixed(1);
            });
        } catch (error) {
            console.log(error);
        }
    };

    const handleRatingUnhover = (event) => {
        const target = event.target;
        const rating = parseFloat(target.parentElement.querySelector('.rating-value').dataset.rating);
        const ratingIndex = Math.ceil(rating) - 1;
        handleRatingHover({target: stars[ratingIndex]});
        ratingValue.innerHTML = `${rating.toFixed(1)} / 5.0`;
    };

    stars.forEach((star) => {
        star.addEventListener("click", handleRatingClick);
        star.addEventListener("mouseover", handleRatingHover);
        star.addEventListener("mouseout", handleRatingUnhover);
    });

    try {
        const gameDocRef = doc(getFirestore(), "games", gameLink);
        getDoc(gameDocRef).then((doc) => {
            const data = doc.data();
            if (data) {
                const ratingIndex = Math.ceil(data.rating) - 1;
                handleRatingHover({target: stars[ratingIndex]});
                ratingValue.innerHTML = `${data.rating.toFixed(1)} / 5.0`;
                ratingValue.dataset.rating = data.rating.toFixed(1);
            } else {
                handleRatingHover({target: stars[0]});
                ratingValue.dataset.rating = 1;
            }
        });
    } catch (error) {
        console.log(error);
    }
});