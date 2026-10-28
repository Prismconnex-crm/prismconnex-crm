-- Records whether an exhibitor's description is the company's own published
-- wording or text we wrote from public information, so the profile page can
-- say which rather than implying the company wrote it.
ALTER TABLE "EventExhibitor" ADD COLUMN "descriptionSource" TEXT;
