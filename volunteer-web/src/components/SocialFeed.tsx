import { useEffect, useState, useRef } from 'react';
import {
    Box, Paper, Typography, Button, TextField, FormControl, Select, MenuItem,
    IconButton, Chip, CircularProgress, Avatar, Collapse, Dialog, DialogTitle,
    DialogContent, DialogActions, InputAdornment, useTheme, alpha, Menu, Popover,
    GlobalStyles
} from '@mui/material';
import DynamicFeedIcon from '@mui/icons-material/DynamicFeed';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import SendIcon from '@mui/icons-material/Send';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ReplyIcon from '@mui/icons-material/Reply';
import ImageIcon from '@mui/icons-material/Image';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import DownloadIcon from '@mui/icons-material/Download';
import ZoomInIcon from '@mui/icons-material/ZoomIn';

import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

import api from '../api/axios';

// --- INTERFÉSZEK ---
interface UserProfile { id: number; name: string; role: string; profileImageUrl?: string; }
interface AnnouncementComment { id: number; userId: number; userName: string; userAvatarUrl?: string; content: string; createdAt: string; parentId: number | null; replies: AnnouncementComment[]; reactionCounts: Record<string, number>; currentUserReaction: string | null; }

// JAVÍTVA: Visszakerült az authorRole a frontend modellbe!
interface Announcement {
    id: number;
    title: string;
    content: string;
    imageUrls: string[];
    authorId: number;
    authorName: string;
    authorAvatarUrl?: string;
    authorRole?: string; // <--- EZ HIÁNYZOTT!
    targetDisplayName: string;
    createdAt: string;
    comments: AnnouncementComment[];
    reactionCounts: Record<string, number>;
    currentUserReaction: string | null;
}

const getImageUrl = (url?: string) => url ? (url.startsWith('http') || url.startsWith('blob:') ? url : `http://localhost:8081${url}`) : undefined;
const formatDate = (dateString: string) => new Date(dateString).toLocaleString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const AVAILABLE_REACTIONS = [
    { type: 'LIKE', emoji: '👍' }, { type: 'HEART', emoji: '❤️' }, { type: 'CLAP', emoji: '👏' }, { type: 'FIRE', emoji: '🔥' }
];

const quillModules = {
    toolbar: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['link'],
        ['clean']
    ],
};

// =========================================================================
// OLVASS TOVÁBB (READ MORE) KOMPONENS - SORSZÁM ALAPÚ (LINE-CLAMP)
// =========================================================================
const ExpandableContent = ({ htmlContent }: { htmlContent: string }) => {
    const [expanded, setExpanded] = useState(false);
    const [isTruncated, setIsTruncated] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const checkTruncation = () => {
            if (contentRef.current && !expanded) {
                const { scrollHeight, clientHeight } = contentRef.current;
                setIsTruncated(scrollHeight > clientHeight + 5);
            }
        };

        checkTruncation();
        const timer = setTimeout(checkTruncation, 100);

        const observer = new ResizeObserver(() => checkTruncation());
        if (contentRef.current) {
            observer.observe(contentRef.current);
            const images = contentRef.current.querySelectorAll('img');
            images.forEach(img => img.addEventListener('load', checkTruncation));
        }

        return () => {
            clearTimeout(timer);
            observer.disconnect();
        };
    }, [htmlContent, expanded]);

    return (
        <Box sx={{ mb: 1 }}>
            <Box
                ref={contentRef}
                className="rich-text-content"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
                sx={{
                    color: 'text.secondary',
                    lineHeight: 1.6,
                    fontSize: { xs: '0.9rem', sm: '1rem' },
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: expanded ? 'unset' : 6,
                    overflow: 'hidden',
                    '& img': { maxWidth: '100%', height: 'auto', borderRadius: 2 },
                    '& p': { m: 0, mb: 1 }, '& ul, & ol': { mt: 0, mb: 1, pl: 3 },
                }}
            />
            {(isTruncated || expanded) && (
                <Button
                    size="small"
                    onClick={() => setExpanded(!expanded)}
                    sx={{ mt: 0.5, px: 0, textTransform: 'none', fontWeight: 'bold', color: 'primary.main', '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' } }}
                >
                    {expanded ? 'Kevesebb megjelenítése' : 'Olvass tovább...'}
                </Button>
            )}
        </Box>
    );
};

// =========================================================================
// ANIMÁLT, ZOOMOLHATÓ ÉS PINCH-TO-ZOOM LIGHTBOX
// =========================================================================
const SwipeableLightbox = ({ open, images, currentIndex, onIndexChange, onClose }: { open: boolean, images: string[], currentIndex: number, onIndexChange: (idx: number) => void, onClose: () => void }) => {
    const [zoomLevel, setZoomLevel] = useState<number>(1);
    const [isPinching, setIsPinching] = useState<boolean>(false);
    const [dragOffset, setDragOffset] = useState<number>(0);

    const lastTapRef = useRef<number>(0);
    const dragStartRef = useRef<{ x: number, y: number } | null>(null);
    const pinchRef = useRef<{ startDist: number, startZoom: number } | null>(null);

    if (!open || images.length === 0) return null;

    const handleClose = () => { setZoomLevel(1); setDragOffset(0); onClose(); };
    const handleNext = (e?: React.MouseEvent) => { if (e) e.stopPropagation(); setZoomLevel(1); setDragOffset(0); onIndexChange((currentIndex + 1) % images.length); };
    const handlePrev = (e?: React.MouseEvent) => { if (e) e.stopPropagation(); setZoomLevel(1); setDragOffset(0); onIndexChange((currentIndex - 1 + images.length) % images.length); };

    const handleDoubleTap = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        const now = Date.now();
        if (now - lastTapRef.current < 300) setZoomLevel(prev => prev === 1 ? 2.5 : 1);
        lastTapRef.current = now;
    };

    const handleDragStart = (clientX: number, clientY: number) => { if (zoomLevel === 1) { dragStartRef.current = { x: clientX, y: clientY }; setDragOffset(0); } };
    const handleDragMove = (clientX: number) => { if (dragStartRef.current && zoomLevel === 1) { setDragOffset(clientX - dragStartRef.current.x); } };
    const handleDragEnd = (clientX: number, clientY: number) => {
        if (dragStartRef.current && zoomLevel === 1) {
            const deltaX = clientX - dragStartRef.current.x;
            const deltaY = clientY - dragStartRef.current.y;
            if (Math.abs(deltaX) > 75 && Math.abs(deltaX) > Math.abs(deltaY)) { if (deltaX < 0) handleNext(); else handlePrev(); } else { setDragOffset(0); }
        }
        dragStartRef.current = null;
    };

    const onTouchStart = (e: React.TouchEvent) => { e.stopPropagation(); if (e.touches.length === 2) { setIsPinching(true); const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); pinchRef.current = { startDist: dist, startZoom: zoomLevel }; } else if (e.touches.length === 1) { handleDragStart(e.touches[0].clientX, e.touches[0].clientY); } };
    const onTouchMove = (e: React.TouchEvent) => { if (e.touches.length === 2 && pinchRef.current) { const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); const scale = dist / pinchRef.current.startDist; const newZoom = Math.min(Math.max(1, pinchRef.current.startZoom * scale), 5); setZoomLevel(newZoom); } else if (e.touches.length === 1) { handleDragMove(e.touches[0].clientX); } };
    const onTouchEnd = (e: React.TouchEvent) => { e.stopPropagation(); setIsPinching(false); pinchRef.current = null; if (e.changedTouches.length === 1) { handleDragEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY); } };
    const onMouseDown = (e: React.MouseEvent) => { e.stopPropagation(); if (e.button !== 0) return; handleDragStart(e.clientX, e.clientY); };
    const onMouseMove = (e: React.MouseEvent) => { if (e.buttons !== 1) return; handleDragMove(e.clientX); };
    const onMouseUp = (e: React.MouseEvent) => { e.stopPropagation(); handleDragEnd(e.clientX, e.clientY); };

    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation(); const link = document.createElement('a'); link.href = images[currentIndex]; link.download = `kép-${Date.now()}.jpg`; document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    const actionButtonSx = { color: 'white', bgcolor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)', '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.8)' }, zIndex: 50 };

    return (
        <Dialog fullScreen open={open} onClose={handleClose} PaperProps={{ sx: { bgcolor: 'rgba(0,0,0,0.95)', backgroundImage: 'none', overflow: 'hidden' } }}>
            <Box
                sx={{ position: 'relative', width: '100vw', height: '100dvh', overflow: 'hidden' }}
                onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
                onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
            >
                <Box sx={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 1, zIndex: 50 }}>
                    <IconButton onClick={handleDownload} sx={actionButtonSx}><DownloadIcon /></IconButton>
                    <IconButton onClick={handleClose} sx={actionButtonSx}><CloseIcon /></IconButton>
                </Box>
                <Box sx={{ position: 'absolute', top: 16, left: 16, zIndex: 50 }}>
                    <Typography color="white" sx={{ bgcolor: 'rgba(0,0,0,0.5)', px: 1.5, py: 0.5, borderRadius: 6, backdropFilter: 'blur(4px)', fontWeight: 'bold' }}>{currentIndex + 1} / {images.length}</Typography>
                </Box>
                {images.length > 1 && (
                    <>
                        <IconButton onClick={handlePrev} sx={{ ...actionButtonSx, display: { xs: 'none', sm: 'flex' }, position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }}><ArrowBackIosNewIcon /></IconButton>
                        <IconButton onClick={handleNext} sx={{ ...actionButtonSx, display: { xs: 'none', sm: 'flex' }, position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)' }}><ArrowForwardIosIcon /></IconButton>
                    </>
                )}

                <Box
                    sx={{
                        display: 'flex', width: `${images.length * 100}vw`, height: '100%',
                        transform: `translateX(calc(-${currentIndex * 100}vw + ${dragOffset}px))`,
                        transition: (isPinching || dragOffset !== 0) ? 'none' : 'transform 0.3s ease-out',
                        touchAction: zoomLevel > 1 ? 'auto' : 'none', cursor: zoomLevel === 1 ? 'grab' : 'auto'
                    }}
                >
                    {images.map((img, idx) => (
                        <Box key={idx} sx={{ width: '100vw', height: '100%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: zoomLevel > 1 ? 'auto' : 'hidden' }}>
                            <Box component="img" src={img} onClick={handleDoubleTap} draggable={false} sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', transform: `scale(${idx === currentIndex ? zoomLevel : 1})`, transition: isPinching ? 'none' : 'transform 0.2s ease', cursor: zoomLevel > 1 ? 'grab' : 'pointer', userSelect: 'none' }} />
                        </Box>
                    ))}
                </Box>
                {zoomLevel > 1 && <Box sx={{ position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)', bgcolor: 'rgba(0,0,0,0.6)', color: 'white', px: 2, py: 1, borderRadius: 6, zIndex: 50, pointerEvents: 'none', backdropFilter: 'blur(4px)' }}><ZoomInIcon sx={{ mr: 1, verticalAlign: 'middle' }}/>Nagyítva</Box>}
            </Box>
        </Dialog>
    );
};

// =========================================================================
// ÖSSZES KÉP RÁCS (GALLERY MODAL)
// =========================================================================
const AllPhotosGridModal = ({ open, images, onClose, onImageSelect }: { open: boolean, images: string[], onClose: () => void, onImageSelect: (idx: number) => void }) => {
    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 4, bgcolor: 'background.paper', minHeight: '50vh' } }}>
            <DialogTitle sx={{ fontWeight: '900', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Fényképek ({images.length})
                <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent sx={{ p: 2 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 1 }}>
                    {images.map((img, idx) => (
                        <Box key={idx} component="img" src={img} onClick={() => { onClose(); onImageSelect(idx); }} sx={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 2, cursor: 'pointer', '&:hover': { opacity: 0.8 } }} />
                    ))}
                </Box>
            </DialogContent>
        </Dialog>
    );
};

// =========================================================================
// FACEBOOK STÍLUSÚ KÉP KOLLÁZS
// =========================================================================
const PostImageGallery = ({ images, onOpenGallery }: { images: string[], onOpenGallery: () => void }) => {
    const count = images.length;
    if (count === 0) return null;
    if (count === 1) return <Box sx={{ mt: 2 }}><Box component="img" src={images[0]} onClick={onOpenGallery} sx={{ width: '100%', maxHeight: 400, objectFit: 'cover', cursor: 'pointer', borderRadius: 2 }} /></Box>;
    if (count === 2) return (
        <Box sx={{ display: 'flex', gap: 0.5, height: 300, borderRadius: 2, overflow: 'hidden', mt: 2 }}>
            <Box component="img" src={images[0]} onClick={onOpenGallery} sx={{ width: '50%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} />
            <Box component="img" src={images[1]} onClick={onOpenGallery} sx={{ width: '50%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} />
        </Box>
    );
    if (count === 3) return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, borderRadius: 2, overflow: 'hidden', mt: 2 }}>
            <Box component="img" src={images[0]} onClick={onOpenGallery} sx={{ width: '100%', height: 250, objectFit: 'cover', cursor: 'pointer' }} />
            <Box sx={{ display: 'flex', gap: 0.5, height: 150 }}>
                <Box component="img" src={images[1]} onClick={onOpenGallery} sx={{ width: '50%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} />
                <Box component="img" src={images[2]} onClick={onOpenGallery} sx={{ width: '50%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} />
            </Box>
        </Box>
    );
    return (
        <Box sx={{ display: 'grid', gap: 0.5, gridTemplateColumns: '1fr 1fr', gridTemplateRows: '200px 200px', borderRadius: 2, overflow: 'hidden', mt: 2 }}>
            <Box component="img" src={images[0]} onClick={onOpenGallery} sx={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} />
            <Box component="img" src={images[1]} onClick={onOpenGallery} sx={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} />
            <Box component="img" src={images[2]} onClick={onOpenGallery} sx={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} />
            <Box sx={{ position: 'relative', cursor: 'pointer' }} onClick={onOpenGallery}>
                <Box component="img" src={images[3]} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {count > 4 && (
                    <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, bgcolor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography variant="h4" color="white" fontWeight="bold">+{count - 4}</Typography>
                    </Box>
                )}
            </Box>
        </Box>
    );
};

// =========================================================================
// REAKCIÓ GOMB KOMPONENS
// =========================================================================
const ReactionButton = ({ currentUserReaction, reactionCounts, onReact, isDarkMode }: { currentUserReaction: string | null, reactionCounts: Record<string, number>, onReact: (type: string) => void, isDarkMode: boolean }) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const totalCount = Object.values(reactionCounts || {}).reduce((a, b) => a + b, 0);
    const currentEmoji = AVAILABLE_REACTIONS.find(r => r.type === currentUserReaction)?.emoji;

    return (
        <>
            <Button size="small" onClick={(e) => setAnchorEl(e.currentTarget)} startIcon={<span style={{ fontSize: '1.2rem' }}>{currentEmoji || '👍'}</span>} sx={{ color: currentUserReaction ? 'primary.main' : 'text.secondary', textTransform: 'none', borderRadius: 6, fontWeight: 'bold', px: { xs: 1, sm: 2 }, minWidth: 0, bgcolor: currentUserReaction ? alpha('#3b82f6', 0.1) : 'transparent' }}>
                {totalCount > 0 ? totalCount : <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Reagál</Box>}
            </Button>
            <Popover open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={() => setAnchorEl(null)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }} transformOrigin={{ vertical: 'bottom', horizontal: 'center' }} PaperProps={{ sx: { borderRadius: 8, p: 0.5, display: 'flex', gap: 0.5, mb: 1, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', bgcolor: isDarkMode ? '#1e293b' : 'white' } }}>
                {AVAILABLE_REACTIONS.map(reaction => (
                    <IconButton key={reaction.type} onClick={() => { onReact(reaction.type); setAnchorEl(null); }} sx={{ bgcolor: currentUserReaction === reaction.type ? alpha('#3b82f6', 0.2) : 'transparent', transition: 'transform 0.2s', '&:hover': { transform: 'scale(1.2)' } }}>
                        <span style={{ fontSize: '1.5rem' }}>{reaction.emoji}</span>
                    </IconButton>
                ))}
            </Popover>
        </>
    );
};

// =========================================================================
// REKURZÍV KOMMENT KOMPONENS
// =========================================================================
const CommentItem = ({
                         comment, announcementId, user, isDarkMode, getImageUrl, formatDate, onReply, onEdit, onDeleteClick, onReact, depth = 0
                     }: {
    comment: AnnouncementComment, announcementId: number, user: UserProfile | null, isDarkMode: boolean, getImageUrl: (url?: string) => string | undefined, formatDate: (dateString: string) => string, onReply: (announcementId: number, parentId: number, content: string) => void, onEdit: (commentId: number, content: string) => void, onDeleteClick: (commentId: number) => void, onReact: (commentId: number, type: string) => void, depth?: number
}) => {
    const [isReplying, setIsReplying] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(comment.content);
    const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);

    const canEdit = user?.id === comment.userId;
    const canDelete = user?.id === comment.userId || user?.role === 'SYS_ADMIN';

    return (
        <Box sx={{ mb: { xs: 1.5, sm: 2 } }}>
            <Box sx={{ display: 'flex', gap: { xs: 1, sm: 1.5 } }}>
                <Avatar src={getImageUrl(comment.userAvatarUrl)} sx={{ width: { xs: 28, sm: 36 }, height: { xs: 28, sm: 36 } }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 1.5 }, borderRadius: 4, bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f1f5f9', border: '1px solid', borderColor: isDarkMode ? 'transparent' : 'divider', position: 'relative' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                                <Typography variant="subtitle2" fontWeight="bold" sx={{ fontSize: { xs: '0.85rem', sm: '0.875rem' } }}>{comment.userName}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>{formatDate(comment.createdAt)}</Typography>
                            </Box>
                            {(canEdit || canDelete) && !isEditing && (
                                <IconButton size="small" onClick={(e) => setMenuAnchorEl(e.currentTarget)} sx={{ mt: -0.5, mr: -0.5 }}><MoreVertIcon fontSize="small" /></IconButton>
                            )}
                        </Box>
                        <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={() => setMenuAnchorEl(null)} PaperProps={{ sx: { borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' } }}>
                            {canEdit && <MenuItem onClick={() => { setIsEditing(true); setMenuAnchorEl(null); }} sx={{ fontSize: '0.85rem' }}><EditIcon fontSize="small" sx={{ mr: 1 }}/> Szerkesztés</MenuItem>}
                            {canDelete && <MenuItem onClick={() => { onDeleteClick(comment.id); setMenuAnchorEl(null); }} sx={{ fontSize: '0.85rem', color: 'error.main' }}><DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }}/> Törlés</MenuItem>}
                        </Menu>

                        {isEditing ? (
                            <Box sx={{ mt: 1 }}>
                                <TextField fullWidth size="small" multiline value={editText} onChange={e => setEditText(e.target.value)} sx={{ mb: 1, bgcolor: 'background.paper', borderRadius: 1 }} />
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button size="small" variant="contained" onClick={() => { if (!editText.trim()) return; onEdit(comment.id, editText); setIsEditing(false); }}>Mentés</Button>
                                    <Button size="small" onClick={() => { setIsEditing(false); setEditText(comment.content); }}>Mégse</Button>
                                </Box>
                            </Box>
                        ) : (
                            <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: { xs: '0.85rem', sm: '0.875rem' } }}>{comment.content}</Typography>
                        )}
                    </Paper>

                    {!isEditing && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 }, mt: 0.5, ml: 1 }}>
                            <ReactionButton currentUserReaction={comment.currentUserReaction} reactionCounts={comment.reactionCounts} onReact={(type) => onReact(comment.id, type)} isDarkMode={isDarkMode} />

                            {depth === 0 && (
                                <Button size="small" startIcon={<ReplyIcon sx={{ fontSize: { xs: 16, sm: 18 } }} />} sx={{ minWidth: 0, px: { xs: 1, sm: 1.5 }, fontSize: { xs: '0.75rem', sm: '0.8rem' }, textTransform: 'none', color: 'text.secondary', fontWeight: 'bold' }} onClick={() => setIsReplying(!isReplying)}>Válasz</Button>
                            )}
                        </Box>
                    )}

                    {isReplying && (
                        <Box sx={{ display: 'flex', gap: 1.5, mt: 1, mb: 2 }}>
                            <Avatar src={getImageUrl(user?.profileImageUrl)} sx={{ width: 28, height: 28 }} />
                            <TextField
                                fullWidth size="small" placeholder={`Válasz...`} value={replyText} onChange={(e) => setReplyText(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if(replyText.trim()){ onReply(announcementId, comment.id, replyText); setReplyText(''); setIsReplying(false);} } }}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 4, bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'white' } }}
                                InputProps={{ endAdornment: (<InputAdornment position="end"><IconButton color="primary" size="small" onClick={() => { if(replyText.trim()){ onReply(announcementId, comment.id, replyText); setReplyText(''); setIsReplying(false);} }} disabled={!replyText.trim()}><SendIcon fontSize="small" /></IconButton></InputAdornment>) }}
                            />
                        </Box>
                    )}

                    {comment.replies && comment.replies.length > 0 && (
                        <Box sx={{
                            mt: { xs: 1, sm: 2 },
                            pl: depth === 0 ? { xs: 1.5, sm: 4 } : 0,
                            ml: depth === 0 ? { xs: 1, sm: 0 } : 0,
                            borderLeft: depth === 0 ? '2px solid' : 'none',
                            borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider'
                        }}>
                            {comment.replies.map(reply => (
                                <CommentItem key={reply.id} comment={reply} announcementId={announcementId} user={user} isDarkMode={isDarkMode} getImageUrl={getImageUrl} formatDate={formatDate} onReply={onReply} onEdit={onEdit} onDeleteClick={onDeleteClick} onReact={onReact} depth={depth + 1} />
                            ))}
                        </Box>
                    )}
                </Box>
            </Box>
        </Box>
    );
};

// =========================================================================
// FŐ SOCIAL FEED KOMPONENS
// =========================================================================
export default function SocialFeed({ user }: { user: UserProfile | null }) {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';

    const [feed, setFeed] = useState<Announcement[]>([]);
    const [validPostTargets, setValidPostTargets] = useState<{value: string, label: string}[]>([]);

    const [createPostOpen, setCreatePostOpen] = useState(false);
    const [postTitle, setPostTitle] = useState('');
    const [postContent, setPostContent] = useState('');
    const [postTarget, setPostTarget] = useState<string>('');
    const [postImages, setPostImages] = useState<File[]>([]);
    const [isPosting, setIsPosting] = useState(false);
    const imageInputRef = useRef<HTMLInputElement>(null);

    const [editPostOpen, setEditPostOpen] = useState(false);
    const [postToEdit, setPostToEdit] = useState<Announcement | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');
    const [editImages, setEditImages] = useState<File[]>([]);
    const [existingImagesToKeep, setExistingImagesToKeep] = useState<string[]>([]);
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const editImageInputRef = useRef<HTMLInputElement>(null);

    const [deletePostId, setDeletePostId] = useState<number | null>(null);
    const [deleteCommentId, setDeleteCommentId] = useState<number | null>(null);
    const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});
    const [expandedComments, setExpandedComments] = useState<Record<number, boolean>>({});
    const [postMenuAnchorEl, setPostMenuAnchorEl] = useState<{ element: HTMLElement, postId: number } | null>(null);

    const [galleryOpen, setGalleryOpen] = useState(false);
    const [galleryImages, setGalleryImages] = useState<string[]>([]);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxImages, setLightboxImages] = useState<string[]>([]);
    const [lightboxIndex, setLightboxIndex] = useState(0);

    const quillWrapperSx = {
        '.ql-container': {
            border: 'none',
            minHeight: '120px',
            fontSize: '1rem',
            fontFamily: 'inherit',
            color: isDarkMode ? '#e2e8f0' : 'inherit',
            borderBottomLeftRadius: 8,
            borderBottomRightRadius: 8,
        },
        '.ql-toolbar': {
            border: 'none',
            borderTop: '1px solid',
            borderBottom: '1px solid',
            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'divider',
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
        },
        '.ql-snow .ql-stroke': { stroke: isDarkMode ? '#cbd5e1' : '#444' },
        '.ql-snow .ql-fill, .ql-snow .ql-stroke.ql-fill': { fill: isDarkMode ? '#cbd5e1' : '#444' },
        '.ql-snow .ql-picker': { color: isDarkMode ? '#cbd5e1' : '#444' },
        '.ql-snow .ql-picker-options': { bgcolor: isDarkMode ? '#1e293b' : 'white' },
        '.ql-editor.ql-blank::before': { color: isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)', fontStyle: 'normal' }
    };

    const titleInputSx = {
        mt: 1,
        mb: 2,
        '& .MuiInputLabel-root': {
            color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
            fontWeight: 'bold',
        },
        '& .MuiOutlinedInput-root': {
            borderRadius: 2,
            bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#f8fafc',
            fontSize: '1.2rem',
            fontWeight: 'bold',
            '& fieldset': { borderColor: 'divider' },
            '&:hover fieldset': { borderColor: 'primary.main' },
            '&.Mui-focused fieldset': { borderColor: 'primary.main' },
        }
    };

    useEffect(() => {
        const fetchFeedData = async () => {
            try {
                const ts = new Date().getTime();
                const [feedRes, targetsRes] = await Promise.all([
                    api.get<Announcement[]>('/announcements/feed', { params: { t: ts } }),
                    api.get<{value: string, label: string}[]>('/announcements/allowed-targets', { params: { t: ts } })
                ]);
                setFeed(feedRes.data);

                const targets = targetsRes.data;
                setValidPostTargets(targets);
                if (targets.length > 0) setPostTarget(targets[0].value);
            } catch (err) { console.error("Feed betöltési hiba", err); }
        };
        fetchFeedData();
    }, []);

    const openEditPostDialog = (announcement: Announcement) => {
        setPostToEdit(announcement);
        setEditTitle(announcement.title);
        setEditContent(announcement.content);
        setExistingImagesToKeep(announcement.imageUrls || []);
        setEditImages([]);
        setEditPostOpen(true);
    };

    const handleCreatePost = async () => {
        const cleanContent = postContent.replace(/<[^>]*>?/gm, '').trim();
        if (!postTitle.trim() || !cleanContent || !postTarget) return;

        setIsPosting(true);
        try {
            const lastIdx = postTarget.lastIndexOf('_');
            const targetType = postTarget.substring(0, lastIdx);
            const targetIdStr = postTarget.substring(lastIdx + 1);

            const formData = new FormData();
            formData.append('title', postTitle); formData.append('content', postContent); formData.append('targetType', targetType);
            if (targetType !== 'GLOBAL') formData.append('targetId', targetIdStr);
            postImages.forEach(img => formData.append('images', img));

            await api.post('/announcements', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

            setPostTitle(''); setPostContent(''); setPostImages([]); setCreatePostOpen(false);
            const feedRes = await api.get<Announcement[]>('/announcements/feed');
            setFeed(feedRes.data);
        } catch (err) { console.error(err); } finally { setIsPosting(false); }
    };

    const handleSavePostEdit = async () => {
        if (!postToEdit) return;
        setIsSavingEdit(true);
        try {
            const formData = new FormData();
            formData.append('title', editTitle); formData.append('content', editContent);
            existingImagesToKeep.forEach(url => formData.append('keptImages', url));
            editImages.forEach(img => formData.append('images', img));

            const res = await api.put<Announcement>(`/announcements/${postToEdit.id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            setFeed(prev => prev.map(a => a.id === postToEdit.id ? res.data : a));
            setEditPostOpen(false);
        } catch (err) { console.error(err); } finally { setIsSavingEdit(false); }
    };

    const confirmDeletePost = async () => {
        if (!deletePostId) return;
        try {
            await api.delete(`/announcements/${deletePostId}`);
            setFeed(prev => prev.filter(a => a.id !== deletePostId));
            setDeletePostId(null);
        } catch (err) { console.error(err); }
    };

    const confirmDeleteComment = async () => {
        if (!deleteCommentId) return;
        try {
            const res = await api.delete<Announcement>(`/announcements/comments/${deleteCommentId}`);
            setFeed(prev => prev.map(a => a.id === res.data.id ? res.data : a));
            setDeleteCommentId(null);
        } catch (err) { console.error(err); }
    };

    const handleTogglePostReaction = async (id: number, type: string) => {
        try {
            const res = await api.post<Announcement>(`/announcements/${id}/reactions`, { type });
            setFeed(prev => prev.map(a => a.id === id ? res.data : a));
        } catch (err) { console.error(err); }
    };

    const handleAddComment = async (id: number) => {
        const text = commentInputs[id];
        if (!text || !text.trim()) return;
        try {
            const res = await api.post<Announcement>(`/announcements/${id}/comments`, { content: text });
            setFeed(prev => prev.map(a => a.id === id ? res.data : a));
            setCommentInputs(prev => ({ ...prev, [id]: '' }));
            setExpandedComments(prev => ({ ...prev, [id]: true }));
        } catch (err) { console.error(err); }
    };

    const handleReplyToComment = async (aId: number, pId: number, content: string) => {
        try {
            const res = await api.post<Announcement>(`/announcements/${aId}/comments/${pId}/reply`, { content });
            setFeed(prev => prev.map(a => a.id === aId ? res.data : a));
        } catch (err) { console.error(err); }
    };

    const handleEditComment = async (cId: number, content: string) => {
        try {
            const res = await api.put<Announcement>(`/announcements/comments/${cId}`, { content });
            setFeed(prev => prev.map(a => a.id === res.data.id ? res.data : a));
        } catch (err) { console.error(err); }
    };

    const handleToggleCommentReaction = async (cId: number, type: string) => {
        try {
            const res = await api.post<Announcement>(`/announcements/comments/${cId}/reactions`, { type });
            setFeed(prev => prev.map(a => a.id === res.data.id ? res.data : a));
        } catch (err) { console.error(err); }
    };

    const openGallery = (images: string[]) => {
        setGalleryImages(images);
        setGalleryOpen(true);
    };

    const openLightboxFromGallery = (index: number) => {
        setLightboxImages(galleryImages);
        setLightboxIndex(index);
        setLightboxOpen(true);
    };

    return (
        <Box mx="auto">
            <GlobalStyles styles={{
                '.rich-text-content a': { color: theme.palette.primary.main, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }
            }} />

            {validPostTargets.length > 0 && (
                <Paper elevation={0} sx={{ p: 2, mb: 4, borderRadius: 4, border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider', bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc' }}>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <Avatar src={getImageUrl(user?.profileImageUrl)} sx={{ width: 44, height: 44 }} />
                        <Box onClick={() => setCreatePostOpen(true)} sx={{ flex: 1, py: 1.5, px: 2.5, borderRadius: 10, cursor: 'pointer', bgcolor: isDarkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.04)', color: 'text.secondary', fontWeight: 'bold', '&:hover': { bgcolor: isDarkMode ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.08)' } }}>
                            Oszd meg a gondolataidat, bejelentéseidet...
                        </Box>
                        <IconButton color="primary" onClick={() => setCreatePostOpen(true)} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}><ImageIcon /></IconButton>
                    </Box>
                </Paper>
            )}

            <Dialog open={createPostOpen} onClose={() => setCreatePostOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, bgcolor: 'background.paper', overflow: 'visible' } }}>
                <DialogTitle sx={{ fontWeight: '900', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                    Bejegyzés létrehozása
                    <IconButton onClick={() => setCreatePostOpen(false)} sx={{ position: 'absolute', right: 8 }}><CloseIcon /></IconButton>
                </DialogTitle>
                <DialogContent sx={{ p: 0 }}>
                    <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar src={getImageUrl(user?.profileImageUrl)} />
                        <Box>
                            <Typography fontWeight="bold" sx={{ lineHeight: 1.2 }}>{user?.name}</Typography>
                            <FormControl variant="standard" size="small">
                                <Select value={postTarget} onChange={(e) => setPostTarget(e.target.value)} disableUnderline sx={{ fontSize: '0.8rem', color: 'primary.main', fontWeight: 'bold' }}>
                                    {validPostTargets.map(t => <MenuItem key={t.value} value={t.value} sx={{ fontSize: '0.85rem' }}>{t.label}</MenuItem>)}
                                </Select>
                            </FormControl>
                        </Box>
                    </Box>
                    <Box sx={{ px: 2, pb: 2 }}>
                        <TextField
                            fullWidth
                            label="Bejelentés címe"
                            placeholder="Írd be a címet..."
                            value={postTitle}
                            onChange={(e) => setPostTitle(e.target.value)}
                            sx={titleInputSx}
                        />

                        <Box sx={quillWrapperSx}>
                            <ReactQuill theme="snow" value={postContent} onChange={setPostContent} modules={quillModules} placeholder="Írd le a részleteket..." />
                        </Box>

                        {postImages.length > 0 && (
                            <Box sx={{ display: 'flex', gap: 1, mt: 2, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 2, overflowX: 'auto' }}>
                                {postImages.map((img, idx) => (
                                    <Box key={idx} sx={{ position: 'relative', flexShrink: 0 }}>
                                        <Box component="img" src={URL.createObjectURL(img)} sx={{ height: 80, width: 80, objectFit: 'cover', borderRadius: 1 }} />
                                        <IconButton size="small" onClick={() => setPostImages(prev => prev.filter((_, i) => i !== idx))} sx={{ position: 'absolute', top: 2, right: 2, bgcolor: 'rgba(0,0,0,0.6)', color: 'white', p: 0.5, '&:hover': { bgcolor: 'black' } }}><CloseIcon sx={{ fontSize: 14 }} /></IconButton>
                                    </Box>
                                ))}
                            </Box>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2, display: 'flex', justifyContent: 'space-between', borderTop: '1px solid', borderColor: 'divider' }}>
                    <Button component="label" startIcon={<PhotoCameraIcon />} sx={{ borderRadius: 6, textTransform: 'none', fontWeight: 'bold' }}>
                        Fotók hozzáadása
                        <input type="file" hidden multiple ref={imageInputRef} accept="image/*" onChange={(e) => { if (e.target.files) setPostImages(prev => [...prev, ...Array.from(e.target.files!)]); if (imageInputRef.current) imageInputRef.current.value = ''; }} />
                    </Button>
                    <Button variant="contained" onClick={handleCreatePost} disabled={isPosting || !postTitle || !postTarget} sx={{ borderRadius: 6, fontWeight: 'bold', px: 4 }} disableElevation>
                        {isPosting ? <CircularProgress size={24} color="inherit" /> : 'Közzététel'}
                    </Button>
                </DialogActions>
            </Dialog>

            {feed.length === 0 ? (
                <Paper elevation={0} sx={{ p: { xs: 4, sm: 6 }, textAlign: 'center', borderRadius: 4, border: '1px dashed', borderColor: 'divider', bgcolor: 'transparent' }}>
                    <DynamicFeedIcon sx={{ fontSize: { xs: 40, sm: 60 }, color: 'text.disabled', mb: 2 }} />
                    <Typography variant="h5" color="text.secondary" fontWeight="bold">Nincs új bejelentés.</Typography>
                </Paper>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {feed.map(announcement => {
                        const canManagePost = user?.role === 'SYS_ADMIN' || user?.id === announcement.authorId;
                        return (
                            <Paper key={announcement.id} elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider', overflow: 'hidden', bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.4)' : 'white' }}>
                                <Box sx={{ p: { xs: 2, sm: 2.5 }, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                        <Avatar src={getImageUrl(announcement.authorAvatarUrl)} sx={{ width: { xs: 40, sm: 48 }, height: { xs: 40, sm: 48 } }} />
                                        <Box>
                                            {/* JAVÍTÁS: ITT VAN A VISSZARAKOTT RANG (ROLE) JELVÉNY! */}
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography fontWeight="900" color="text.primary" sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}>
                                                    {announcement.authorName}
                                                </Typography>
                                                {announcement.authorRole && announcement.authorRole !== 'Önkéntes' && announcement.authorRole !== 'USER' && (
                                                    <Chip
                                                        label={announcement.authorRole}
                                                        size="small"
                                                        sx={{
                                                            height: 18, fontSize: '0.65rem', fontWeight: 'bold',
                                                            bgcolor: announcement.authorRole === 'Főszervező' || announcement.authorRole === 'Rendszergazda' ? alpha(theme.palette.error.main, 0.1) : alpha(theme.palette.primary.main, 0.1),
                                                            color: announcement.authorRole === 'Főszervező' || announcement.authorRole === 'Rendszergazda' ? 'error.main' : 'primary.main'
                                                        }}
                                                    />
                                                )}
                                            </Box>

                                            <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                                                {formatDate(announcement.createdAt)} • <span style={{ color: theme.palette.primary.main }}>{announcement.targetDisplayName}</span>
                                            </Typography>
                                        </Box>
                                    </Box>
                                    {canManagePost && <IconButton onClick={(e) => setPostMenuAnchorEl({ element: e.currentTarget, postId: announcement.id })}><MoreVertIcon /></IconButton>}
                                </Box>

                                <Box sx={{ px: { xs: 2, sm: 2.5 }, pb: 2 }}>
                                    <Typography variant="h6" fontWeight="800" gutterBottom sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>{announcement.title}</Typography>

                                    <ExpandableContent htmlContent={announcement.content} />
                                </Box>

                                {announcement.imageUrls && announcement.imageUrls.length > 0 && (
                                    <Box sx={{ px: { xs: 2, sm: 2.5 }, pb: 2 }}>
                                        <PostImageGallery images={announcement.imageUrls.map(url => getImageUrl(url) as string)} onOpenGallery={() => openGallery(announcement.imageUrls.map(url => getImageUrl(url) as string))} />
                                    </Box>
                                )}

                                <Box sx={{ px: { xs: 1.5, sm: 2.5 }, py: 1, display: 'flex', gap: 1, borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider', bgcolor: isDarkMode ? 'rgba(0,0,0,0.1)' : alpha(theme.palette.primary.main, 0.01) }}>
                                    <ReactionButton currentUserReaction={announcement.currentUserReaction} reactionCounts={announcement.reactionCounts} onReact={(type) => handleTogglePostReaction(announcement.id, type)} isDarkMode={isDarkMode} />
                                    <Button size="small" variant="text" color="inherit" sx={{ ml: 'auto', fontWeight: 'bold', borderRadius: 6, fontSize: { xs: '0.75rem', sm: '0.875rem' } }} startIcon={<ChatBubbleOutlineIcon sx={{ fontSize: { xs: 16, sm: 20 } }} />} onClick={() => setExpandedComments(prev => ({ ...prev, [announcement.id]: !prev[announcement.id] }))}>
                                        {announcement.comments.reduce((acc, c) => acc + 1 + (c.replies ? c.replies.length : 0), 0)}
                                        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, ml: 0.5 }}>Komment</Box>
                                    </Button>
                                </Box>

                                <Collapse in={expandedComments[announcement.id]}>
                                    <Box sx={{ p: { xs: 1.5, sm: 2.5 }, bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#f8fafc' }}>
                                        {announcement.comments.map(comment => (
                                            <CommentItem key={comment.id} comment={comment} announcementId={announcement.id} user={user} isDarkMode={isDarkMode} getImageUrl={getImageUrl} formatDate={formatDate} onReply={handleReplyToComment} onEdit={handleEditComment} onDeleteClick={(cId) => setDeleteCommentId(cId)} onReact={handleToggleCommentReaction} />
                                        ))}
                                        <Box sx={{ display: 'flex', gap: { xs: 1, sm: 1.5 }, mt: 2 }}>
                                            <Avatar src={getImageUrl(user?.profileImageUrl)} sx={{ width: { xs: 28, sm: 36 }, height: { xs: 28, sm: 36 } }} />
                                            <TextField fullWidth size="small" placeholder="Írj egy kommentet..." value={commentInputs[announcement.id] || ''} onChange={(e) => setCommentInputs(prev => ({ ...prev, [announcement.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(announcement.id); } }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 4, bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'white' } }} InputProps={{ endAdornment: (<InputAdornment position="end"><IconButton color="primary" size="small" onClick={() => handleAddComment(announcement.id)} disabled={!commentInputs[announcement.id]?.trim()}><SendIcon fontSize="small" /></IconButton></InputAdornment>) }} />
                                        </Box>
                                    </Box>
                                </Collapse>
                            </Paper>
                        )})}
                </Box>
            )}

            <Menu anchorEl={postMenuAnchorEl?.element} open={Boolean(postMenuAnchorEl)} onClose={() => setPostMenuAnchorEl(null)} PaperProps={{ sx: { borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' } }}>
                <MenuItem onClick={() => { const post = feed.find(f => f.id === postMenuAnchorEl?.postId); if (post) openEditPostDialog(post); setPostMenuAnchorEl(null); }}><EditIcon fontSize="small" sx={{ mr: 1.5 }}/> Szerkesztés</MenuItem>
                <MenuItem onClick={() => { setDeletePostId(postMenuAnchorEl?.postId || null); setPostMenuAnchorEl(null); }} sx={{ color: 'error.main' }}><DeleteOutlineIcon fontSize="small" sx={{ mr: 1.5 }}/> Törlés</MenuItem>
            </Menu>

            <Dialog open={editPostOpen} onClose={() => setEditPostOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.98)' : 'white', m: 2 } }}>
                <DialogTitle sx={{ fontWeight: '900', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                    Bejegyzés szerkesztése
                    <IconButton onClick={() => setEditPostOpen(false)} sx={{ position: 'absolute', right: 8 }}><CloseIcon /></IconButton>
                </DialogTitle>
                <DialogContent sx={{ p: 3, pt: 3 }}>
                    <TextField
                        fullWidth
                        label="Bejegyzés címe"
                        placeholder="Írd be a címet..."
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        sx={titleInputSx}
                    />

                    <Box sx={{ mb: 2, ...quillWrapperSx }}>
                        <ReactQuill theme="snow" value={editContent} onChange={setEditContent} modules={quillModules} />
                    </Box>

                    <Typography variant="subtitle2" fontWeight="bold" mb={1}>Képek kezelése</Typography>
                    <Box sx={{ display: 'flex', gap: 1, mb: 2, p: 1, border: '1px dashed', borderColor: 'divider', borderRadius: 2, flexWrap: 'wrap' }}>
                        {existingImagesToKeep.map((url) => (
                            <Box key={url} sx={{ position: 'relative', width: 80, height: 80 }}>
                                <Box component="img" src={getImageUrl(url)} sx={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 1, opacity: 0.8 }} />
                                <IconButton size="small" onClick={() => setExistingImagesToKeep(prev => prev.filter(u => u !== url))} sx={{ position: 'absolute', top: -5, right: -5, bgcolor: 'error.main', color: 'white', p: 0.2, '&:hover': { bgcolor: 'error.dark' } }}><CloseIcon sx={{ fontSize: 16 }}/></IconButton>
                            </Box>
                        ))}
                        {editImages.map((img, idx) => (
                            <Box key={idx} sx={{ position: 'relative', width: 80, height: 80 }}>
                                <Box component="img" src={URL.createObjectURL(img)} sx={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 1, border: '2px solid', borderColor: 'success.main' }} />
                                <IconButton size="small" onClick={() => setEditImages(prev => prev.filter((_, i) => i !== idx))} sx={{ position: 'absolute', top: -5, right: -5, bgcolor: 'error.main', color: 'white', p: 0.2, '&:hover': { bgcolor: 'error.dark' } }}><CloseIcon sx={{ fontSize: 16 }}/></IconButton>
                            </Box>
                        ))}
                        <Box component="label" sx={{ width: 80, height: 80, border: '1px dashed', borderColor: 'primary.main', borderRadius: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'primary.main', '&:hover': { bgcolor: 'action.hover' } }}>
                            <PhotoCameraIcon />
                            <Typography variant="caption" fontWeight="bold">Hozzáad</Typography>
                            <input type="file" hidden multiple accept="image/*" ref={editImageInputRef} onChange={(e) => { if (e.target.files) setEditImages(prev => [...prev, ...Array.from(e.target.files!)]); if (editImageInputRef.current) editImageInputRef.current.value=''; }} />
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Button onClick={() => setEditPostOpen(false)} sx={{ fontWeight: 'bold' }} color="inherit">Mégse</Button>
                    <Button onClick={handleSavePostEdit} variant="contained" disabled={!editTitle || isSavingEdit} sx={{ borderRadius: 2, fontWeight: 'bold' }}>Mentés</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(deletePostId)} onClose={() => setDeletePostId(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
                <DialogTitle sx={{ fontWeight: '900', color: 'error.main' }}>Poszt törlése</DialogTitle>
                <DialogContent><Typography>Biztosan törölni szeretnéd ezt a bejegyzést? Ez a művelet nem vonható vissza.</Typography></DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setDeletePostId(null)} color="inherit" sx={{ fontWeight: 'bold' }}>Mégse</Button>
                    <Button onClick={confirmDeletePost} variant="contained" color="error" sx={{ borderRadius: 2, fontWeight: 'bold' }}>Törlés</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(deleteCommentId)} onClose={() => setDeleteCommentId(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
                <DialogTitle sx={{ fontWeight: '900', color: 'error.main' }}>Komment törlése</DialogTitle>
                <DialogContent><Typography>Biztosan törölni szeretnéd ezt a kommentet? Az összes rá érkezett válasz is törlődni fog.</Typography></DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setDeleteCommentId(null)} color="inherit" sx={{ fontWeight: 'bold' }}>Mégse</Button>
                    <Button onClick={confirmDeleteComment} variant="contained" color="error" sx={{ borderRadius: 2, fontWeight: 'bold' }}>Törlés</Button>
                </DialogActions>
            </Dialog>

            <AllPhotosGridModal open={galleryOpen} images={galleryImages} onClose={() => setGalleryOpen(false)} onImageSelect={openLightboxFromGallery} />
            <SwipeableLightbox open={lightboxOpen} images={lightboxImages} currentIndex={lightboxIndex} onIndexChange={setLightboxIndex} onClose={() => setLightboxOpen(false)} />
        </Box>
    );
}